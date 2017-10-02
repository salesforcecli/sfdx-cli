declare module 'cli-engine-heroku/lib/vars' {
    export class Vars {
        env: typeof process.env

        constructor(env: typeof process.env);
        host: string;
        apiUrl: string;
        apiHost: string;
        gitHost: string;
        httpGitHost: string;
        gitPrefixes: string[];
    }

    export default new Vars(process.env)
}
