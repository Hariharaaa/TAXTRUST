import fs from 'fs';
import path from 'path';

const SRC_DIR = './src';

const replacements = {
  'bg-bgprimary': 'bg-[#0A0A0A]',
  'text-bgprimary': 'text-[#0A0A0A]',
  'bg-bgpanel': 'bg-[#141414]',
  'bg-lime': 'bg-[#D4F536]',
  'text-lime': 'text-[#D4F536]',
  'border-lime': 'border-[#D4F536]',
  'ring-lime': 'ring-[#D4F536]',
  'bg-limehover': 'bg-[#e0ff5a]',
  'text-textprimary': 'text-white',
  'text-textmuted': 'text-[#9B9B95]',
  'border-bordersubtle': 'border-white/10',
  'bg-cream': 'bg-[#E9E7DA]',
  'bg-danger': 'bg-[#FF4D4D]',
  'text-danger': 'text-[#FF4D4D]',
  'border-danger': 'border-[#FF4D4D]',
  'bg-success': 'bg-[#22C55E]',
  'border-success': 'border-[#22C55E]',
  'text-success': 'text-[#22C55E]'
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const [oldClass, newClass] of Object.entries(replacements)) {
        // Replace exact word matches, but allow trailing utility modifiers like /20
        const regex = new RegExp(`\\b${oldClass}(?!\\w)`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, newClass);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(SRC_DIR);
console.log('Done.');
