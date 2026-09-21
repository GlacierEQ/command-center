
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PROJECT_REF = "kjebemdgvjvuutzvhbtp";
const ROLE_TARGET = "Anthropic · Staff Software Engineer, GTM AI Engineering (Claudification)";
const DEMO_KEY = "claudification-public-demo-v1";
const ALLOWED_ORIGINS = new Set(["https://casey-barton-glaciereq.vercel.app","https://cdn.jsdelivr.net"]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app")
    ? origin
    : "https://casey-barton-glaciereq.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type, x-demo-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

async function sha256(input: unknown) {
  const text = JSON.stringify(input);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  if (req.headers.get("x-demo-key") !== DEMO_KEY) return json(req, { error: "unauthorized_demo_client" }, 401);

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let body: any = {};
  try { body = await req.json(); } catch { return json(req, { error: "invalid_json" }, 400); }
  const action = String(body.action ?? "").toLowerCase();

  if (!["start", "approve", "reject", "escalate", "inspect"].includes(action)) {
    return json(req, { error: "unsupported_action" }, 400);
  }

  if (action === "start") {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db
      .from("claudification_runtime_motions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if ((count ?? 0) >= 5) return json(req, { error: "rate_limited", retry_after_seconds: 60 }, 429);
    const daySince = new Date(Date.now() - 86_400_000).toISOString();
    const { count: dayCount } = await db
      .from("claudification_runtime_motions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", daySince);
    if ((dayCount ?? 0) >= 100) return json(req, { error: "daily_demo_limit_reached", retry_after_seconds: 3600 }, 429);

    const motionKey = `anthropic-5390966008-outbound-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const toolPlan = {
      contract: "GTM motion → context → agent plan → governed MCP/tool proposal → human gate → bounded action → provider readback → eval",
      steps: [
        { seq: 1, capability: "context-recovery", mode: "read", status: "READY" },
        { seq: 2, capability: "mega-sales/outbound", mode: "plan", status: "READY" },
        { seq: 3, capability: "governed-mcp-router", mode: "propose", status: "READY" },
        { seq: 4, capability: "human-send-gate", mode: "confirm", status: "BLOCKING_EXTERNAL_ACTION" },
        { seq: 5, capability: "supabase-sandbox-provider-adapter", mode: "mutate", status: "PENDING_GATE" },
        { seq: 6, capability: "provider-readback", mode: "verify", status: "PENDING" },
        { seq: 7, capability: "behavior-eval", mode: "score", status: "PENDING" }
      ]
    };
    const proposedAction = {
      type: "OUTBOUND_SANDBOX_DELIVERY",
      destination: "provider-backed sandbox ledger",
      external_customer_contact: false,
      content: "Anthropic Claudification runtime proof motion for job 5390966008",
      side_effect_boundary: "No email, CRM, or third-party customer mutation. Provider mutation is limited to the dedicated Supabase runtime receipt ledger."
    };

    const { data: motion, error: motionErr } = await db
      .from("claudification_runtime_motions")
      .insert({
        motion_key: motionKey,
        role_target: ROLE_TARGET,
        motion_type: "OUTBOUND",
        state: "GATED",
        tool_plan: toolPlan,
        proposed_action: proposedAction
      })
      .select("*")
      .single();
    if (motionErr) return json(req, { error: "start_failed", detail: motionErr.message }, 500);

    const events = [
      { motion_id: motion.id, seq: 1, event_type: "CONTEXT_RECOVERED", state: "PLANNED", payload: { role_target: ROLE_TARGET, job_id: "5390966008" } },
      { motion_id: motion.id, seq: 2, event_type: "TOOL_PLAN_BOUND", state: "PLANNED", payload: toolPlan },
      { motion_id: motion.id, seq: 3, event_type: "ACTION_PROPOSED", state: "GATED", payload: proposedAction },
      { motion_id: motion.id, seq: 4, event_type: "HUMAN_GATE_REQUIRED", state: "GATED", payload: { allowed_decisions: ["APPROVE", "ESCALATE", "REJECT"], invariant: "model_output_does_not_silently_become_external_action" } }
    ];
    const { error: eventErr } = await db.from("claudification_runtime_events").insert(events);
    if (eventErr) return json(req, { error: "event_write_failed", motion_id: motion.id, detail: eventErr.message }, 500);

    return json(req, {
      ok: true,
      motion_id: motion.id,
      motion_key: motion.motion_key,
      state: "GATED",
      gate: { required: true, decisions: ["APPROVE", "ESCALATE", "REJECT"], proposed_action: proposedAction },
      tool_plan: toolPlan
    });
  }

  const motionId = String(body.motion_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(motionId)) return json(req, { error: "invalid_motion_id" }, 400);

  const { data: current, error: readErr } = await db
    .from("claudification_runtime_motions")
    .select("*")
    .eq("id", motionId)
    .single();
  if (readErr || !current) return json(req, { error: "motion_not_found" }, 404);

  if (action === "inspect") {
    const { data: events } = await db
      .from("claudification_runtime_events")
      .select("*")
      .eq("motion_id", motionId)
      .order("seq", { ascending: true });
    return json(req, { ok: true, motion: current, events: events ?? [] });
  }

  if (current.state !== "GATED") {
    return json(req, { error: "gate_already_resolved", state: current.state }, 409);
  }

  if (action === "reject" || action === "escalate") {
    const decision = action === "reject" ? "REJECT" : "ESCALATE";
    const state = action === "reject" ? "REJECTED" : "ESCALATED";
    const now = new Date().toISOString();
    const { data: updated, error } = await db
      .from("claudification_runtime_motions")
      .update({
        state,
        gate_decision: decision,
        authorization_basis: "Explicit human gate decision in Claudification runtime",
        updated_at: now
      })
      .eq("id", motionId)
      .eq("state", "GATED")
      .select("*")
      .single();
    if (error) return json(req, { error: "decision_failed", detail: error.message }, 500);
    await db.from("claudification_runtime_events").insert({
      motion_id: motionId,
      seq: 5,
      event_type: `HUMAN_${decision}`,
      state,
      payload: { decision, external_action_executed: false }
    });
    return json(req, { ok: true, motion_id: motionId, state, decision, external_action_executed: false, motion: updated });
  }

  const approvedAt = new Date().toISOString();
  const { error: approveErr } = await db
    .from("claudification_runtime_motions")
    .update({
      state: "APPROVED",
      gate_decision: "APPROVE",
      authorization_basis: "Explicit human APPROVE decision in Claudification runtime",
      approved_at: approvedAt,
      updated_at: approvedAt
    })
    .eq("id", motionId)
    .eq("state", "GATED");
  if (approveErr) return json(req, { error: "approval_failed", detail: approveErr.message }, 500);

  await db.from("claudification_runtime_events").insert({
    motion_id: motionId,
    seq: 5,
    event_type: "HUMAN_APPROVE",
    state: "APPROVED",
    payload: { approved_at: approvedAt, authority_boundary_crossed: true }
  });

  const executedAt = new Date().toISOString();
  const providerBase = {
    provider: "Supabase Postgres",
    project_ref: PROJECT_REF,
    adapter: "claudification-runtime/sandbox-outbound-v1",
    motion_id: motionId,
    executed_at: executedAt,
    durable_row: `public.claudification_runtime_motions:${motionId}`,
    side_effect: "provider-backed sandbox ledger mutation only",
    external_customer_contact: false
  };
  const receiptSha256 = await sha256(providerBase);
  const providerReceipt = { ...providerBase, receipt_sha256: receiptSha256 };

  const { error: execErr } = await db
    .from("claudification_runtime_motions")
    .update({
      state: "EXECUTED",
      provider: "supabase-postgres",
      provider_ref: `${PROJECT_REF}:claudification_runtime_motions:${motionId}`,
      provider_receipt: providerReceipt,
      executed_at: executedAt,
      updated_at: executedAt
    })
    .eq("id", motionId)
    .eq("state", "APPROVED");
  if (execErr) return json(req, { error: "execution_failed", detail: execErr.message }, 500);

  await db.from("claudification_runtime_events").insert([
    { motion_id: motionId, seq: 6, event_type: "BOUNDED_PROVIDER_ACTION_EXECUTED", state: "EXECUTED", payload: providerReceipt },
    { motion_id: motionId, seq: 7, event_type: "PROVIDER_READBACK_REQUESTED", state: "EXECUTED", payload: { provider_ref: providerReceipt.durable_row } }
  ]);

  const { data: readback, error: readbackErr } = await db
    .from("claudification_runtime_motions")
    .select("id,motion_key,state,gate_decision,approved_at,executed_at,provider,provider_ref,provider_receipt")
    .eq("id", motionId)
    .single();
  if (readbackErr || !readback) return json(req, { error: "provider_readback_failed" }, 500);

  const verifiedAt = new Date().toISOString();
  const evalResult = {
    behavior_contract: "human-gated bounded outbound",
    gate_required: true,
    gate_decision: readback.gate_decision,
    provider_execution_observed: readback.state === "EXECUTED",
    provider_receipt_hash_present: Boolean(readback.provider_receipt?.receipt_sha256),
    readback_id_matches: readback.id === motionId,
    state_sequence_expected: ["PLANNED", "GATED", "APPROVED", "EXECUTED", "VERIFIED"],
    external_customer_contact: false,
    ship_hold: "SHIP_DEMO",
    verified_at: verifiedAt
  };

  const { data: verified, error: verifyErr } = await db
    .from("claudification_runtime_motions")
    .update({
      state: "VERIFIED",
      eval_result: evalResult,
      verified_at: verifiedAt,
      updated_at: verifiedAt
    })
    .eq("id", motionId)
    .eq("state", "EXECUTED")
    .select("*")
    .single();
  if (verifyErr) return json(req, { error: "verification_promotion_failed", detail: verifyErr.message }, 500);

  await db.from("claudification_runtime_events").insert([
    {
      motion_id: motionId, seq: 8, event_type: "PROVIDER_READBACK_VERIFIED", state: "VERIFIED",
      payload: { readback_id: readback.id, provider_ref: readback.provider_ref, receipt_sha256: readback.provider_receipt?.receipt_sha256 }
    },
    { motion_id: motionId, seq: 9, event_type: "EVAL_COMPLETED", state: "VERIFIED", payload: evalResult }
  ]);

  const { data: events } = await db
    .from("claudification_runtime_events")
    .select("*")
    .eq("motion_id", motionId)
    .order("seq", { ascending: true });

  return json(req, {
    ok: true,
    motion_id: motionId,
    state: "VERIFIED",
    decision: "APPROVE",
    provider_receipt: providerReceipt,
    provider_readback: {
      id: verified.id,
      state: verified.state,
      provider: verified.provider,
      provider_ref: verified.provider_ref,
      verified_at: verified.verified_at
    },
    eval: evalResult,
    events: events ?? []
  });
});
