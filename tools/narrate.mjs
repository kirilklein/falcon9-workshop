// Voice every bubble text with ElevenLabs: node tools/narrate.mjs [voiceId]
// Needs ELEVENLABS_API_KEY. Skips clips that already exist; delete audio/ to re-voice.
import fs from 'fs';
import { hash } from '../src/util.js';

const voice = process.argv[2] || 'EXAVITQu4vr4xnSDxMaL';
const src = fs.readFileSync('src/rocket.js', 'utf8') + fs.readFileSync('src/engine.js', 'utf8') + fs.readFileSync('src/flight.js', 'utf8');
fs.mkdirSync('audio', { recursive: true });
for (const [, text] of src.matchAll(/text: '([^']+)'/g)) {
  const file = `audio/${hash(text)}.mp3`;
  if (fs.existsSync(file)) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text: text.replace('▶', 'зелёную кнопку'), model_id: 'eleven_multilingual_v2' }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log(file, text.slice(0, 40));
}
