import { createApp } from './app.ts';

const host = '127.0.0.1';
const port = 3000;

createApp().listen(port, host, () => {
  console.log(`http://${host}:${port}`);
});
