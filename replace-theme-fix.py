with open('src/app/congresos/[id]/landing/landing-client.tsx', 'r') as f:
    content = f.read()

# Fixes for things that were wrong
content = content.replace('bg-white/60', 'bg-slate-100/80')
content = content.replace('text-slate-600', 'text-[#5a5b5d]')
content = content.replace('from-slate-900/80', 'from-white/80')
content = content.replace('text-white flex items-center gap-3', 'text-[#37383a] flex items-center gap-3')
content = content.replace('text-2xl font-bold text-white', 'text-2xl font-bold text-[#37383a]')
content = content.replace('text-2xl font-black text-white', 'text-2xl font-black text-[#37383a]')
content = content.replace('text-xl font-bold text-white', 'text-xl font-bold text-[#37383a]')
content = content.replace('text-white font-black text-xs', 'text-[#37383a] font-black text-xs')
content = content.replace('text-white line-clamp-1', 'text-[#37383a] line-clamp-1')
content = content.replace('text-white text-base', 'text-[#37383a] text-base')
content = content.replace('text-white font-medium', 'text-[#37383a] font-medium')
content = content.replace('className="text-white"', 'className="text-[#37383a]"')

content = content.replace('bg-slate-700 text-[#37383a]', 'bg-slate-200 text-[#37383a]')
content = content.replace('hover:bg-slate-700 text-[#37383a]', 'hover:bg-slate-300 text-[#37383a]')

# For the 'text-white' inside the `<strong>Dr. {clientName || 'Registrado'}</strong>`
content = content.replace('className="text-white">Dr. ', 'className="text-[#37383a]">Dr. ')

# For the cart headers and text
content = content.replace('text-[#37383a] font-bold text-xs cursor-pointer', 'text-[#37383a] font-bold text-xs cursor-pointer')

# Let's fix buttons back to text-white just in case:
content = content.replace('text-[#37383a] hover:text-white', 'text-[#5a5b5d] hover:text-[#37383a]')

with open('src/app/congresos/[id]/landing/landing-client.tsx', 'w') as f:
    f.write(content)
print('Done fixing theme')
