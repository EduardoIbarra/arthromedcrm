const fs = require('fs');
const file = 'src/app/congresos/[id]/landing/landing-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace main background
content = content.replace(/bg-slate-950/g, 'bg-[#f0f5fa]');

// Replace orbs (optional, maybe make them blue/indigo but visible on light)
// Keep orbs but adjust opacity or colors if needed. Let's just leave them as they use blue/indigo.

// Replace text colors for main text
content = content.replace(/text-slate-200/g, 'text-[#37383a]');
content = content.replace(/text-slate-300/g, 'text-[#5a5b5d]');
content = content.replace(/text-slate-400/g, 'text-[#5a5b5d]');
content = content.replace(/text-slate-500/g, 'text-[#8a8b8d]');

// Replace card backgrounds
content = content.replace(/bg-white\/\[0\.03\]/g, 'bg-white');
content = content.replace(/bg-white\/\[0\.02\]/g, 'bg-white');
content = content.replace(/bg-slate-950\/40/g, 'bg-[#f8fafc]');
content = content.replace(/bg-slate-900/g, 'bg-white');

// Replace borders
content = content.replace(/border-white\/\[0\.08\]/g, 'border-[#d4e0ec]');
content = content.replace(/border-white\/\[0\.05\]/g, 'border-[#d4e0ec]');
content = content.replace(/border-white\/\[0\.04\]/g, 'border-[#d4e0ec]');

// Replace hovers
content = content.replace(/hover:bg-white\/\[0\.06\]/g, 'hover:bg-[#f8fafc]');
content = content.replace(/hover:bg-white\/\[0\.05\]/g, 'hover:bg-[#f8fafc]');
content = content.replace(/hover:bg-white\/10/g, 'hover:bg-[#e8f1f9]');

// Replace specific white texts that should be dark on light mode (headers, etc.)
// Careful: Don't replace text-white inside buttons (bg-blue-600, btn-primary, bg-emerald-600, etc.)
// It's safer to use regex that checks if it's not preceded by a button background.
// Or just manually fix the ones we know.
// Actually, `text-white` on headers should be `text-[#37383a]`.
content = content.replace(/text-white(?!.*(bg-blue|bg-emerald|btn-primary|from-blue|bg-purple|bg-rose))/g, 'text-[#37383a]');
// A better way: replace `text-white` with `text-[#37383a]` globally, then revert the ones inside specific buttons?
// No, the negative lookahead above only looks ahead in the line, which won't work well.

// Let's replace 'text-white' specifically where it's used for headings and text.
content = content.replace(/text-white mb-8/g, 'text-[#37383a] mb-8');
content = content.replace(/text-white mb-6/g, 'text-[#37383a] mb-6');
content = content.replace(/text-white mb-2/g, 'text-[#37383a] mb-2');
content = content.replace(/text-white mb-4/g, 'text-[#37383a] mb-4');
content = content.replace(/text-white mb-3/g, 'text-[#37383a] mb-3');
content = content.replace(/text-white text-lg/g, 'text-[#37383a] text-lg');
content = content.replace(/text-white text-base/g, 'text-[#37383a] text-base');
content = content.replace(/text-white text-sm/g, 'text-[#37383a] text-sm');
content = content.replace(/text-white font-medium/g, 'text-[#37383a] font-medium');
content = content.replace(/text-white line-clamp-1/g, 'text-[#37383a] line-clamp-1');
content = content.replace(/text-white\/95/g, 'text-[#37383a]');

// Fix cart text colors
content = content.replace(/text-white font-bold text-xs/g, 'text-[#37383a] font-bold text-xs');
// but inside buttons, we need text-white back
content = content.replace(/bg-blue-600 text-\[#37383a\]/g, 'bg-blue-600 text-white');
content = content.replace(/bg-slate-700 text-\[#37383a\]/g, 'bg-slate-700 text-white');
content = content.replace(/hover:bg-slate-700 text-\[#37383a\]/g, 'hover:bg-slate-700 text-white');
content = content.replace(/hover:bg-blue-500 text-\[#37383a\]/g, 'hover:bg-blue-500 text-white');
content = content.replace(/bg-emerald-600 hover:bg-emerald-500 text-\[#37383a\]/g, 'bg-emerald-600 hover:bg-emerald-500 text-white');
content = content.replace(/bg-blue-600 hover:bg-blue-500 text-\[#37383a\]/g, 'bg-blue-600 hover:bg-blue-500 text-white');

// Background overlays
content = content.replace(/bg-slate-950\/60/g, 'bg-slate-900/40');
content = content.replace(/bg-slate-950\/70/g, 'bg-slate-900/40');
content = content.replace(/bg-slate-950\/80/g, 'bg-slate-900/40');

fs.writeFileSync(file, content);
console.log('Done replacing theme colors');
