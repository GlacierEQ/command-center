(()=>{
  'use strict';

  const TABLE_MAP=Object.freeze({
    apex_connector_status:'ops_plane_connector_status',
    apex_connector_health:'ops_plane_connector_health',
    apex_gap_register:'ops_plane_gaps',
    apex_system_registry:'ops_plane_registry',
    everything_mcp_domains:'ops_plane_mcp_domains',
    everything_mcp_connectors:'ops_plane_mcp_connectors',
    ops_plane_connector_status:'ops_plane_connector_status',
    ops_plane_connector_health:'ops_plane_connector_health',
    ops_plane_gaps:'ops_plane_gaps',
    ops_plane_registry:'ops_plane_registry',
    ops_plane_mcp_domains:'ops_plane_mcp_domains',
    ops_plane_mcp_connectors:'ops_plane_mcp_connectors'
  });

  function install(namespace){
    if(!namespace||typeof namespace.createClient!=='function'){
      throw new Error('Supabase SDK createClient is unavailable');
    }
    if(namespace.__commandCenterOpsPlaneInstalled)return namespace;

    const originalCreateClient=namespace.createClient.bind(namespace);
    namespace.createClient=(...args)=>{
      const client=originalCreateClient(...args);
      if(!client||typeof client.from!=='function'){
        throw new Error('Supabase client does not expose from()');
      }
      const originalFrom=client.from.bind(client);
      client.from=(requested)=>{
        const resolved=TABLE_MAP[requested];
        if(!resolved){
          throw new Error(`Command Center refused non-ops-plane table: ${requested}`);
        }
        return originalFrom(resolved);
      };
      return client;
    };
    Object.defineProperty(namespace,'__commandCenterOpsPlaneInstalled',{value:true,enumerable:false});
    return namespace;
  }

  const api=Object.freeze({TABLE_MAP,install});
  if(typeof globalThis!=='undefined')globalThis.CC_DATA_CONTRACT=api;
  if(typeof window!=='undefined'&&window.supabase)install(window.supabase);
})();
