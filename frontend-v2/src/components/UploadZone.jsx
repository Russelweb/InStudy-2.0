import { motion, AnimatePresence } from 'framer-motion';

const UploadZone = ({ onFileSelected, isUploading, progress }) => {
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Drop Zone */}
      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="lg:col-span-2 relative group"
        onClick={() => document.getElementById('fileInput').click()}
      >
        <input 
          type="file" 
          id="fileInput" 
          className="hidden" 
          onChange={handleFileChange}
          accept=".pdf,.txt,.docx"
        />
        <div className="h-64 border-2 border-dashed border-secondary/20 rounded-2xl bg-surface-container-low flex flex-col items-center justify-center transition-all group-hover:border-secondary/50 group-hover:bg-surface-container-high/50 cursor-pointer overflow-hidden">
          <div className="bg-[#551a8b] w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">upload_file</span>
          </div>
          <h3 className="text-xl font-bold text-on-surface">Upload Your Study Material</h3>
          <p className="text-on-surface-variant mt-1">Drag and Drop PDF, TXT, or DOCX files</p>
          <div className="mt-6 flex gap-4">
            <span className="text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-bold tracking-widest uppercase">Max 200MB</span>
            <span className="text-[10px] px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-bold tracking-widest uppercase">OCR Enabled</span>
          </div>
        </div>
      </motion.div>

      {/* Processing State */}
      <AnimatePresence>
        {isUploading && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="surface-container-high glass-panel p-6 rounded-2xl border border-primary/10 flex flex-col justify-between shadow-2xl overflow-hidden relative"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary relative">
                  <span className="material-symbols-outlined">description</span>
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute -inset-2 bg-primary/20 blur-xl rounded-full"
                  ></motion.div>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface truncate max-w-[150px]">Current Upload</h4>
                  <p className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Processing Document</p>
                </div>
              </div>
              <span className="text-primary font-black text-sm">{Math.round(progress)}%</span>
            </div>
            <div className="mt-auto">
              <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-primary relative"
                >
                  <motion.div 
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute top-0 right-0 h-full w-8 bg-white/20 blur-sm"
                  ></motion.div>
                </motion.div>
              </div>
              <div className="flex justify-between mt-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">
                <span>Parsing Semantic Structures</span>
                <span className="text-primary">ETA {Math.max(1, 5 - Math.floor(progress/20))}s</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export default UploadZone;
