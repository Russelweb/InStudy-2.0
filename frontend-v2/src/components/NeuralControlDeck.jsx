import { motion } from 'framer-motion';

const NeuralControlDeck = ({ annotations = [] }) => {
  const latestAnnotations = [...annotations]
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 4);

  const typeStyles = {
     'note': { bg: 'bg-tertiary-fixed' },
     'summary': { bg: 'bg-secondary' },
     'key_point': { bg: 'bg-primary' },
     'question': { bg: 'bg-error' }
  };

  const mappedAnnotations = latestAnnotations.map(ann => ({
      text: ann.content,
      type: (ann.type || 'insight').replace('_', ' '),
      colorClass: (typeStyles[ann.type] || typeStyles.note).bg,
      id: ann.id
  }));

  return (
    <footer className="hidden md:flex fixed bottom-0 left-0 w-full h-[120px] z-50 bg-[#050505] border-t border-outline-variant/10 px-12 justify-between items-center shadow-[0px_-10px_30px_rgba(0,0,0,0.5)]">
      {/* Left: Annotations Zone */}
      <div className="flex-grow flex items-center gap-4">
        <div className="flex flex-col gap-1 pr-6 border-r border-white/10">
          <span className="text-[10px] font-black tracking-widest uppercase text-secondary/80">Active Annotations</span>
          <span className="text-[9px] text-white/40">{annotations.length} Insights Captured</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar max-w-2xl px-2 py-2">
          {mappedAnnotations.map((note, idx) => (
            <motion.div 
              key={note.id}
              whileHover={{ rotate: 0, scale: 1.05 }}
              className={`min-w-[180px] max-w-[220px] bg-surface-container-high/95 backdrop-blur-md p-3 rounded-lg border border-outline-variant/10 cursor-pointer transform ${idx % 2 === 0 ? '-rotate-1' : 'rotate-2'} shadow-lg`}
            >
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className={`w-2 h-2 rounded-full ${note.colorClass}`}></div>
                <span className="text-[8px] uppercase font-bold text-on-surface-variant shrink-0">{note.type}</span>
              </div>
              <p className="text-[10px] text-on-surface line-clamp-3 font-medium">{note.text}</p>
            </motion.div>
          ))}
        </div>
      </div>

{/*        */}{/* Right: Neural Control Panel */}
{/*       <div className="flex items-center gap-4 pl-8 border-l border-white/10"> */}
{/*         <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group"> */}
{/*           <span className="material-symbols-outlined text-lg group-hover:text-secondary">quiz</span> */}
{/*           <span className="text-xs font-bold tracking-widest uppercase">Generate Quiz</span> */}
{/*         </button> */}
{/*         <button className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3 rounded-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 group"> */}
{/*           <span className="material-symbols-outlined text-lg group-hover:text-primary">summarize</span> */}
{/*           <span className="text-xs font-bold tracking-widest uppercase">Summarize</span> */}
{/*         </button> */}
{/*         <button className="bg-secondary text-[#00452d] font-black px-6 py-3 rounded-xl flex items-center gap-3 transition-all hover:scale-105 hover:brightness-110 active:scale-95 shadow-lg shadow-secondary/20"> */}
{/*           <span className="material-symbols-outlined text-lg">terminal</span> */}
{/*           <span className="text-xs font-bold tracking-widest uppercase">Extract Concepts</span> */}
{/*         </button> */}
{/*       </div> */}

      {/* Branding Overlay */}
      <div className="absolute bottom-2 right-4 opacity-30 pointer-events-none">
        <span className="text-[8px] text-white font-black tracking-tighter uppercase">ControlDeck Neural Interface v2.0</span>
      </div>
    </footer>
  );
};

export default NeuralControlDeck;
