// NOTE this is pseudocode for claude to understand my general intent
const config = readConfig();

const hookClients = config.hooks.map(hook => {
    if (isBuiltIn(hook)) { // true if it is just a "name" in the config
        const path = nameToPath(hook.name); // something like AuditHook to @civic/audit-hook
        const hookModule = await import(path + "/hook"); // by convention, the default export of /hook is the hook class
        return new HookClient(hookModule);
    } else if (isRemote(hook)) { // true if it has a url
        // remote clients are easy
        return new RemoteHookClient({
            url: hook.url,
            name: hook.name,
        })
    }
    // this is all we support right now, but you could imagine being able to pass a directory with more hooks defined in it
})

const passthroughServer = new PassthroughServer({
    hooks: hookClients // or whatever the passthrough server expects
}