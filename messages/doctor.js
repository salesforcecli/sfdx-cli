module.exports = {
  commandDescription: 'Run the doctor.',
  flags: {
    command: 'Run the specified command in debug mode and write results to a file.',
    newissue: 'Create a new GitHub issue for the CLI.',
    plugin: 'Run doctor command diagnostics for a specific plugin.',
  },
  examples: [
    `Display release notes for the currently installed CLI version:
$ <%= config.bin %> <%= command.id %>
Display release notes for CLI version 7.120.0:
$ <%= config.bin %> <%= command.id %> --version 7.120.0
Display release notes for the CLI version that corresponds to a tag (%s):
$ <%= config.bin %> <%= command.id %> --version latest
  `,
  ],
  footer: `---
- Run \`%s whatsnew\` to manually view the current release notes.
- You can also view them on GitHub by visiting the [forcedotcom/cli](%s) repo.
- Silence notes by setting the \`%s\` env var to \`true\`.
- Hide this footer by setting the \`%s\` env var to \`true\`.
---`,
};
