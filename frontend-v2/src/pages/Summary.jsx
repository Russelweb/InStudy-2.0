import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { summaryService, documentService, statService, assetService } from '../services/api';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';
import EmptyState from '../components/EmptyState';
import { InputModal } from '../components/Modal';
import ScrollToTopButton from '../components/ScrollToTopButton';

const summaryStyles = [
  {
    id: 'short',
    label: 'Quick Review',
    desc: 'A short set of key points for fast revision.',
    icon: 'bolt',
  },
  {
    id: 'detailed',
    label: 'Full Study Notes',
    desc: 'A clear breakdown with more detail and examples.',
    icon: 'subject',
  },
  {
    id: 'exam',
    label: 'Exam Prep',
    desc: 'Focuses on likely test points and useful terms.',
    icon: 'school',
  },
];

const steps = [
  { id: 0, label: 'Course', helper: 'Choose material' },
  { id: 1, label: 'Settings', helper: 'Configure Summary' },
  { id: 2, label: 'Create', helper: 'Review and generate' },
];

const Summary = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { triggerAura } = useAura();
  useAuraHelp('Choose a course, pick the document and summary style, then create your summary. You can add a focus topic if you only want one part covered.');
  const urlCourseId = searchParams.get('id');

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [style, setStyle] = useState('detailed');
  const [topic, setTopic] = useState('');
  const [courseQuery, setCourseQuery] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [latestSummary, setLatestSummary] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedCourseData = useMemo(
    () => courses.find((course) => course.id === selectedCourse),
    [courses, selectedCourse]
  );
  const selectedStyleData = summaryStyles.find((item) => item.id === style) || summaryStyles[1];
  const filteredCourses = useMemo(() => {
    const query = courseQuery.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) => course.name.toLowerCase().includes(query));
  }, [courses, courseQuery]);
  const canContinueFromCourse = Boolean(selectedCourse);
  const canGenerate = Boolean(selectedCourse) && !isGenerating;

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await statService.getCourses();
        const courseList = response.data.courses || [];
        setCourses(courseList);

        if (courseList.length > 0 && !selectedCourse) {
          const id = courseList[0].id;
          setSelectedCourse(id);
          localStorage.setItem('activeCourse', id);
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      }
    };
    fetchCourses();
  }, [selectedCourse]);

  useEffect(() => {
    const restoreLatestSummary = () => {
      const viewSummary = localStorage.getItem('summary_view_data');
      if (!viewSummary) {
        setLatestSummary(null);
        return;
      }

      try {
        setLatestSummary(JSON.parse(viewSummary));
      } catch (error) {
        console.error('Failed to restore latest summary:', error);
        setLatestSummary(null);
      }
    };

    restoreLatestSummary();
    window.addEventListener('focus', restoreLatestSummary);
    return () => window.removeEventListener('focus', restoreLatestSummary);
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;

    const fetchDocuments = async () => {
      try {
        const response = await documentService.listByCourse(selectedCourse);
        setDocuments(response.data.documents || []);
        setSelectedDocument(null);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        setDocuments([]);
      }
    };
    fetchDocuments();
  }, [selectedCourse]);

  const goToStep = (step) => {
    if (step > 0 && !canContinueFromCourse) return;
    setActiveStep(step);
  };

  const chooseCourse = (courseId) => {
    setSelectedCourse(courseId);
    localStorage.setItem('activeCourse', courseId);
  };

  const handleGenerate = async () => {
    if (!selectedCourse) return;

    setActiveStep(2);
    setIsGenerating(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 15, 90));
    }, 500);

    try {
      const response = await summaryService.generate(
        selectedCourse,
        selectedDocument,
        style,
        topic || null
      );

      setProgress(100);
      const result = {
        ...response.data,
        style,
        document: selectedDocument,
        courseName: selectedCourseData?.name || 'Unknown Course'
      };
      const viewData = {
        ...result,
        course_id: selectedCourse
      };
      localStorage.setItem('load_asset_summary', JSON.stringify({ data: viewData, course_id: selectedCourse, title: result.courseName }));
      localStorage.setItem('summary_view_data', JSON.stringify(viewData));
      setLatestSummary(viewData);
      navigate('/summary-view');
      triggerAura('celebrating', `Summary ready - ${result.courseName} is prepared as ${selectedStyleData.label}.`);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      const msg = error.response?.data?.detail || '';
      if (msg.includes('No documents')) {
        triggerAura('concerned', 'This course has no documents yet. Upload one in Knowledge Base first.',
          { label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') });
      } else if (msg.includes('API key') || error.response?.status === 401) {
        triggerAura('concerned', 'No API key configured. Add your Groq key in Settings.',
          { label: 'Open Settings', onClick: () => navigate('/settings') });
      } else {
        showToast('Something went wrong generating the summary. Please try again.', 'error');
      }
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  const handleSaveLatest = () => {
    if (!latestSummary) return;
    setSaveModalOpen(true);
  };

  const handleSaveLatestConfirm = async (title) => {
    if (!latestSummary?.course_id) {
      showToast('No course is attached to this summary, so it cannot be saved yet.', 'error');
      return;
    }

    setSaveModalOpen(false);
    setIsSaving(true);
    try {
      const data = {
        ...latestSummary,
        saved_at: new Date().toISOString(),
      };
      await assetService.save(
        latestSummary.course_id,
        'summary',
        title,
        data,
        {
          style: latestSummary.style,
          document: latestSummary.document || 'All documents',
          course_name: latestSummary.courseName,
        }
      );

      const updated = { ...latestSummary, saved: true, savedTitle: title };
      setLatestSummary(updated);
      localStorage.setItem('summary_view_data', JSON.stringify(updated));
      showToast('Summary saved successfully!', 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save summary. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-background p-3 sm:p-4 md:p-6 relative overflow-hidden">
      <div className="fixed top-1/4 -right-64 h-[600px] w-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none z-0" />
      <div className="absolute -top-24 -left-24 h-64 w-64 bg-secondary/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 md:mb-6"
        >
          <div className="mb-5">
            <StepLoader activeStep={activeStep} onStepClick={goToStep} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-secondary mb-2">
            AI Summarizer
          </p>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-on-surface mb-2">
            Build a Clear Summary
          </h1>
          <p className="text-on-surface-variant max-w-2xl leading-relaxed text-sm">
            Choose what to summarize, set the kind of notes you want, then let InStudy prepare a clean study-ready summary.
          </p>
        </motion.header>

        {latestSummary && (
          <LatestSummaryBar
            summary={latestSummary}
            isSaving={isSaving}
            onView={() => navigate('/summary-view')}
            onSave={handleSaveLatest}
          />
        )}

        {courses.length === 0 ? (
          <EmptyState
            icon="auto_awesome"
            title="No courses yet"
            description="Create a course and upload a document before generating a summary."
            action={{ label: 'Go to Knowledge Base', onClick: () => navigate('/knowledge') }}
          />
        ) : (
          <section className="bg-surface-container-low/70 border border-outline-variant/15 rounded-2xl md:rounded-[1.25rem] p-4 sm:p-5 md:p-6 shadow-xl shadow-black/10">
            <AnimatePresence mode="wait">
              {activeStep === 0 && (
                <StepPanel key="course">
                  <CourseStep
                    courses={courses}
                    filteredCourses={filteredCourses}
                    selectedCourse={selectedCourse}
                    selectedCourseData={selectedCourseData}
                    courseQuery={courseQuery}
                    setCourseQuery={setCourseQuery}
                    onSelect={chooseCourse}
                    onNext={() => setActiveStep(1)}
                    canContinue={canContinueFromCourse}
                  />
                </StepPanel>
              )}

              {activeStep === 1 && (
                <StepPanel key="options">
                  <OptionsStep
                    documents={documents}
                    selectedDocument={selectedDocument}
                    setSelectedDocument={setSelectedDocument}
                    style={style}
                    setStyle={setStyle}
                    topic={topic}
                    setTopic={setTopic}
                    onBack={() => setActiveStep(0)}
                    onNext={() => setActiveStep(2)}
                  />
                </StepPanel>
              )}

              {activeStep === 2 && (
                <StepPanel key="create">
                  <CreateStep
                    course={selectedCourseData}
                    selectedDocument={selectedDocument}
                    selectedStyle={selectedStyleData}
                    topic={topic}
                    isGenerating={isGenerating}
                    progress={progress}
                    canGenerate={canGenerate}
                    onBack={() => setActiveStep(1)}
                    onGenerate={handleGenerate}
                  />
                </StepPanel>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
      <ScrollToTopButton />

      <InputModal
        open={saveModalOpen}
        title="Save Summary"
        description="Give this summary a name so it appears in Saved Assets."
        placeholder={`e.g. ${latestSummary?.courseName || 'Course'} study summary`}
        confirmLabel="Save Summary"
        onConfirm={handleSaveLatestConfirm}
        onCancel={() => setSaveModalOpen(false)}
      />
    </div>
  );
};

const LatestSummaryBar = ({ summary, isSaving, onView, onSave }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 bg-surface-container border border-secondary/20 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
  >
    <div className="flex items-center gap-3 min-w-0">
      <span className="h-10 w-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-lg">article</span>
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Latest Summary</p>
        <h3 className="text-sm font-black text-on-surface truncate">
          {summary.courseName || 'Generated summary'}
        </h3>
        <p className="text-xs text-on-surface-variant truncate">
          {summary.document || 'All documents'} - {summary.style || 'Study notes'}
        </p>
      </div>
    </div>

    <div className="flex gap-2 sm:justify-end">
      <button
        onClick={onView}
        className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-secondary/10 text-secondary text-xs font-black uppercase tracking-widest hover:bg-secondary/15 transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-base">visibility</span>
        View
      </button>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-[#551a8b] text-white text-xs font-black uppercase tracking-widest hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-base">{summary.saved ? 'bookmark_added' : 'save'}</span>
        {summary.saved ? 'Saved' : 'Save'}
      </button>
    </div>
  </motion.div>
);

const StepLoader = ({ activeStep, onStepClick }) => (
  <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-3xl">
    {steps.map((step, index) => {
      const completed = activeStep > index;
      const active = activeStep === index;

      return (
        <button
          key={step.id}
          onClick={() => onStepClick(index)}
          className="group text-left"
          disabled={index > 0 && activeStep === 0}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-xs font-black border transition-all ${
                completed
                  ? 'bg-secondary text-on-secondary border-secondary'
                  : active
                    ? 'bg-primary text-on-primary border-primary shadow-[0_0_18px_rgba(189,157,255,0.18)]'
                    : 'bg-surface-container-high text-on-surface-variant border-outline-variant/15'
              }`}
            >
              {completed ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-[10px] font-black uppercase tracking-widest ${active || completed ? 'text-secondary' : 'text-on-surface-variant'}`}>
                {step.label}
              </span>
              <span className="hidden sm:block text-[10px] text-on-surface-variant/70 truncate">
                {step.helper}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className={`h-full rounded-full transition-all ${active || completed ? 'w-full bg-secondary' : 'w-0 bg-secondary'}`} />
          </div>
        </button>
      );
    })}
  </div>
);

const StepPanel = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.24 }}
  >
    {children}
  </motion.div>
);

const CourseStep = ({
  courses,
  filteredCourses,
  selectedCourse,
  selectedCourseData,
  courseQuery,
  setCourseQuery,
  onSelect,
  onNext,
  canContinue,
}) => (
  <div>
    <StepHeading
      eyebrow="Step 1"
      title="Choose a Course"
      description="Pick the course that contains the material you want summarized."
    />

    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.25fr] gap-4 mt-5">
      <div className="bg-surface-container border border-secondary/25 rounded-xl p-4 md:p-5 min-w-0">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">menu_book</span>
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-1">Selected Course</p>
            <h3 className="text-base md:text-lg font-black text-on-surface truncate">
              {selectedCourseData?.name || 'Choose a course'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {selectedCourseData ? `${selectedCourseData.document_count || 0} documents ready` : `${courses.length} courses available`}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-3 md:p-4">
        <div className="flex items-center gap-2 bg-surface-container-high rounded-lg px-3 py-2 border border-outline-variant/15">
          <span className="material-symbols-outlined text-base text-on-surface-variant">search</span>
          <input
            type="text"
            value={courseQuery}
            onChange={(event) => setCourseQuery(event.target.value)}
            placeholder="Search courses"
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] lg:max-h-[188px] overflow-y-auto custom-scrollbar pr-1">
          {filteredCourses.map((course) => {
            const selected = selectedCourse === course.id;
            return (
              <button
                key={course.id}
                onClick={() => onSelect(course.id)}
                className={`h-14 px-3 rounded-lg border text-left transition-all flex items-center gap-3 min-w-0 ${
                  selected
                    ? 'bg-secondary/10 border-secondary text-secondary'
                    : 'bg-surface-container-low border-outline-variant/10 text-on-surface-variant hover:border-secondary/35 hover:text-on-surface'
                }`}
              >
                <span className={`material-symbols-outlined text-lg shrink-0 ${selected ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {selected ? 'check_circle' : 'school'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black truncate">{course.name}</span>
                  <span className="block text-[10px] opacity-75 truncate">{course.document_count || 0} documents</span>
                </span>
              </button>
            );
          })}

          {filteredCourses.length === 0 && (
            <div className="sm:col-span-2 h-20 rounded-lg border border-dashed border-outline-variant/20 flex items-center justify-center text-sm text-on-surface-variant">
              No matching courses
            </div>
          )}
        </div>
      </div>
    </div>

    <StepActions>
      <button
        onClick={onNext}
        disabled={!canContinue}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Next: Settings
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </button>
    </StepActions>
  </div>
);

const OptionsStep = ({
  documents,
  selectedDocument,
  setSelectedDocument,
  style,
  setStyle,
  topic,
  setTopic,
  onBack,
  onNext,
}) => (
  <div>
    <StepHeading
      eyebrow="Step 2"
      title="Set Your Summary Options"
      description="Choose the source, format, and optional topic focus using simple settings."
    />

    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-4 md:gap-5 mt-5">
      <div className="space-y-3">
        <SectionLabel icon="description" label="Source Document" />
        <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-3 max-h-[248px] overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setSelectedDocument(null)}
            className={`w-full h-12 flex items-center gap-3 px-3 rounded-lg border text-left transition-all text-sm font-bold ${
              !selectedDocument
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-lg">layers</span>
            All documents in this course
          </button>

          <div className="space-y-2 mt-2">
            {documents.map((doc) => (
              <button
                key={doc}
                onClick={() => setSelectedDocument(selectedDocument === doc ? null : doc)}
                  className={`w-full h-12 flex items-center gap-3 px-3 rounded-lg border text-left transition-all text-sm ${
                  selectedDocument === doc
                    ? 'bg-primary/10 border-primary text-primary font-bold'
                    : 'border-outline-variant/10 text-on-surface-variant hover:border-primary/30'
                }`}
              >
                <span className="material-symbols-outlined text-lg">article</span>
                <span className="truncate">{doc}</span>
              </button>
            ))}
          </div>

          {documents.length === 0 && (
            <p className="text-xs text-on-surface-variant mt-3 p-3 rounded-lg bg-surface-container-high/50">
              This course has no documents yet. You can still continue, but you may need to upload material first.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <SectionLabel icon="tune" label="Summary Style" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {summaryStyles.map((item) => {
              const selected = style === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setStyle(item.id)}
                  className={`p-3 rounded-xl border text-left transition-all min-h-[116px] ${
                    selected
                      ? 'bg-secondary/10 border-secondary'
                      : 'bg-surface-container border-outline-variant/15 hover:border-secondary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`material-symbols-outlined text-lg ${selected ? 'text-secondary' : 'text-on-surface-variant'}`}>{item.icon}</span>
                    <span className={`text-sm font-black ${selected ? 'text-secondary' : 'text-on-surface'}`}>{item.label}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel icon="center_focus_strong" label="Focus Topic (optional)" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. photosynthesis, contract law, cell division"
            className="mt-3 w-full bg-surface-container border border-outline-variant/20 rounded-xl py-2.5 px-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <p className="text-xs text-on-surface-variant mt-2">
            Leave this empty to summarize everything selected.
          </p>
        </div>
      </div>
    </div>

    <StepActions>
      <BackButton onClick={onBack} />
      <button
        onClick={onNext}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        Next: Review
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </button>
    </StepActions>
  </div>
);

const CreateStep = ({
  course,
  selectedDocument,
  selectedStyle,
  topic,
  isGenerating,
  progress,
  canGenerate,
  onBack,
  onGenerate,
}) => (
  <div>
    <StepHeading
      eyebrow="Step 3"
      title="Review and Create"
      description="Check your choices, then generate the summary."
    />

    <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-4 md:gap-5 mt-5 items-stretch">
      <div className="bg-surface-container border border-outline-variant/15 rounded-xl p-4 md:p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl signature-gradient flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white">auto_awesome</span>
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black text-on-surface tracking-tight">Ready to make your summary</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed mt-2">
              InStudy will read the selected material and prepare notes in the style you chose.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
          <ReviewItem icon="menu_book" label="Course" value={course?.name || 'No course selected'} />
          <ReviewItem icon="article" label="Material" value={selectedDocument || 'All documents'} />
          <ReviewItem icon={selectedStyle.icon} label="Style" value={selectedStyle.label} />
          <ReviewItem icon="center_focus_strong" label="Focus" value={topic || 'Everything selected'} />
        </div>

        {isGenerating && (
          <div className="mt-6">
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-secondary shadow-[0_0_10px_rgba(105,246,184,0.35)] rounded-full"
              />
            </div>
            <p className="text-[10px] text-secondary font-black tracking-widest uppercase mt-3">
              {Math.round(progress)}% - Creating your summary...
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-4 md:p-5 flex flex-col justify-between">
        <div>
          <SectionLabel icon="checklist" label="What Happens Next" />
          <div className="space-y-2.5 mt-4">
            {['Reads your selected course material', 'Pulls out the main ideas', 'Writes a clear study summary'].map((item, index) => (
              <div key={item} className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span className="h-7 w-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center text-xs font-black">{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full py-4 rounded-xl bg-[#551a8b] text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  className="material-symbols-outlined text-base"
                >
                  progress_activity
                </motion.span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                Generate Summary
              </>
            )}
          </button>
          <BackButton onClick={onBack} disabled={isGenerating} fullWidth />
        </div>
      </div>
    </div>
  </div>
);

const StepHeading = ({ eyebrow, title, description }) => (
  <div>
    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary mb-2">{eyebrow}</p>
    <h2 className="text-xl sm:text-2xl md:text-[1.65rem] font-black text-on-surface tracking-tight">{title}</h2>
    <p className="text-sm text-on-surface-variant leading-relaxed mt-1.5 max-w-2xl">{description}</p>
  </div>
);

const SectionLabel = ({ icon, label }) => (
  <div className="flex items-center gap-2">
    <span className="material-symbols-outlined text-base text-secondary">{icon}</span>
    <p className="text-xs font-black uppercase tracking-widest text-on-surface">{label}</p>
  </div>
);

const StepActions = ({ children }) => (
  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-5 md:mt-6">
    {children}
  </div>
);

const BackButton = ({ onClick, disabled = false, fullWidth = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${fullWidth ? 'w-full' : 'w-full sm:w-auto'} px-5 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-black text-xs uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-2`}
  >
    <span className="material-symbols-outlined text-base">arrow_back</span>
    Back
  </button>
);

const ReviewItem = ({ icon, label, value }) => (
  <div className="bg-surface-container-high/70 border border-outline-variant/10 rounded-xl p-3 min-w-0">
    <div className="flex items-center gap-2 text-on-surface-variant mb-1.5">
      <span className="material-symbols-outlined text-base">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-sm font-bold text-on-surface truncate">{value}</p>
  </div>
);

export default Summary;
