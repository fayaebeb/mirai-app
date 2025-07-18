import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineWobble } from 'ldrs/react'
import 'ldrs/react/LineWobble.css'
type SuggestionPanelProps = {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onClose: () => void;
  isLoading?: boolean;
};

const SuggestionPanel = ({ suggestions, isLoading = false, onSelect, onClose }: SuggestionPanelProps) => {
  return (
    <AnimatePresence>
      {(suggestions.length > 0 || isLoading ) && (
        <motion.div
          className="relative min-w-[340px] w-full md:max-w-[40rem] md:min-w-[40rem]  border border-noble-black-800 shadow-md bg-black/90 backdrop-blur-md  rounded-2xl p-3 mb-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close suggestions"
            className="absolute left-1/2 bottom-0 translate-x-[-50%] translate-y-1/2 p-1 flex items-center justify-center  focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full bg-black text-noble-black-100 border border-noble-black-800 hover:text-noble-black-200"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <LineWobble
                size="80"
                stroke="5"
                bgOpacity="0.1"
                speed="1.75"
                color="#F2F2F2"
              />
            </div>
          )}

          {/* Suggestion chips */}
          {!isLoading && suggestions.length > 0 && (
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex gap-2  py-2">
                {suggestions.map((sugg, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="rounded-full px-3 py-1 text-sm border border-border bg-background hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring transition-all"
                    onClick={() => onSelect(sugg)}
                  >
                    {sugg}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuggestionPanel;
