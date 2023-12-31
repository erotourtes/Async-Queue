import fs from 'fs/promises';

async function main() {
  try {
    const data = await fs.readFile('./main.ts', 'utf8');
    console.log(data);
  } catch (err) {
    console.error('error');
  }
}

main();
