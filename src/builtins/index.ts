import Update from './update';

export const commands = [
    Update
];

export const topics = commands.map((cmd) => {
    return {
        topic: cmd.topic,
        command: cmd.command,
        description: cmd.description
    };
});
