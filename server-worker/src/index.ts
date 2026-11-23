// M0 migration/runtime skeleton. Production auth is implemented in M1.
export default { async fetch():Promise<Response> { return Response.json({error:{code:'milestone_pending',message:'The production Worker backend arrives in M1. Use the demo preview for M0.'}},{status:503}); } };
