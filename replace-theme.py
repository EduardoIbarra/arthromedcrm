import re

with open('src/app/congresos/[id]/landing/landing-client.tsx', 'r') as f:
    content = f.read()

# Replace main background
content = content.replace('bg-slate-950', 'bg-[#f0f5fa]')

# Replace text colors for main text
content = content.replace('text-slate-200', 'text-[#37383a]')
content = content.replace('text-slate-300', 'text-[#5a5b5d]')
content = content.replace('text-slate-400', 'text-[#5a5b5d]')
content = content.replace('text-slate-500', 'text-[#8a8b8d]')

# Replace card backgrounds
content = content.replace('bg-white/[0.03]', 'bg-white')
content = content.replace('bg-white/[0.02]', 'bg-white')
content = content.replace('bg-slate-950/40', 'bg-[#f8fafc]')
content = content.replace('bg-slate-900', 'bg-white')
content = content.replace('bg-slate-800', 'bg-[#f0f5fa]')

# Replace borders
content = content.replace('border-white/[0.08]', 'border-[#d4e0ec]')
content = content.replace('border-white/[0.05]', 'border-[#d4e0ec]')
content = content.replace('border-white/[0.04]', 'border-[#d4e0ec]')

# Replace hovers
content = content.replace('hover:bg-white/[0.06]', 'hover:bg-[#f8fafc]')
content = content.replace('hover:bg-white/[0.05]', 'hover:bg-[#f8fafc]')
content = content.replace('hover:bg-white/10', 'hover:bg-[#e8f1f9]')

# Replace specific white texts that should be dark on light mode (headers, etc.)
content = content.replace('text-white mb-8', 'text-[#37383a] mb-8')
content = content.replace('text-white mb-6', 'text-[#37383a] mb-6')
content = content.replace('text-white mb-2', 'text-[#37383a] mb-2')
content = content.replace('text-white mb-4', 'text-[#37383a] mb-4')
content = content.replace('text-white mb-3', 'text-[#37383a] mb-3')
content = content.replace('text-white text-lg', 'text-[#37383a] text-lg')
content = content.replace('text-white text-base', 'text-[#37383a] text-base')
content = content.replace('text-white text-sm', 'text-[#37383a] text-sm')
content = content.replace('text-white font-medium', 'text-[#37383a] font-medium')
content = content.replace('text-white line-clamp-1', 'text-[#37383a] line-clamp-1')
content = content.replace('text-white/95', 'text-[#37383a]')
content = content.replace('text-white font-bold text-xs', 'text-[#37383a] font-bold text-xs')

# Fix cart text colors that we accidentally replaced
content = content.replace('bg-blue-600 text-[#37383a]', 'bg-blue-600 text-white')
content = content.replace('bg-[#f0f5fa] text-[#37383a]', 'bg-[#f0f5fa] text-[#37383a]') 
content = content.replace('hover:bg-[#f0f5fa] text-[#37383a]', 'hover:bg-[#f0f5fa] text-[#37383a]')

# Background overlays
content = content.replace('bg-slate-950/60', 'bg-slate-900/40')
content = content.replace('bg-slate-950/70', 'bg-slate-900/40')
content = content.replace('bg-slate-950/80', 'bg-slate-900/40')

with open('src/app/congresos/[id]/landing/landing-client.tsx', 'w') as f:
    f.write(content)
print('Done replacing theme colors')
