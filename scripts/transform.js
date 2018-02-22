// Reads a JSON stream from stdin, applies a transform function, and logs the result
/* eslint-disable no-console */
module.exports = (transformer) => {
    const chunks = [];
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => console.log(transformer(JSON.parse(chunks.join()))));
};
