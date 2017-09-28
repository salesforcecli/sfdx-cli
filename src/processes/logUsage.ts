
import Analytics from "../analytics";

process.on("message", ({ config, plugin, commandId, time }) => {
    new Analytics(config).record(plugin, commandId, time).catch(console.error);
});
