import { useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronDown, Check, Database, DatabaseIcon, ArrowLeftRight, DatabaseZap } from "lucide-react";
import { useRecoilState } from "recoil";
import { dropdownOpenState } from "@/states/databaseDropdownState";

const searchModes = [
  { value: "files", label: "うごき統計", icon: <DatabaseIcon className="w-4 h-4" /> },
  { value: "ktdb", label: "来た来ぬ", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: "ibt", label: "インバウンド", icon: <DatabaseZap className="w-4 h-4" /> },
];

export default function DbButton({
  useDb,
  setUseDb,
  selectedDb,
  setSelectedDb,
}: {
  useDb: boolean;
  setUseDb: (v: boolean) => void;
  selectedDb: string;
  setSelectedDb: (v: string) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonGroupRef = useRef<HTMLDivElement>(null); // New ref for entire group
  const [isDropdownOpen, setIsDropdownOpen] = useRecoilState(dropdownOpenState);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (isDropdownOpen && dropdownRef.current && buttonGroupRef.current) {
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const groupRect = buttonGroupRef.current.getBoundingClientRect();

      setCoords({
        top: groupRect.top - dropdownRect.height,
        left: groupRect.left,
      });
    }
  }, [isDropdownOpen]);

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDropdownOpen((prev) => !prev);
  };

  return (
    <div id="select-database-button" className="relative overflow-visible flex">
      <div ref={buttonGroupRef} className="flex">
        <button
          onClick={(e) => {
            e.preventDefault();
            setUseDb(!useDb);
          }}
          className={`h-[40px] flex items-center justify-center flex-shrink-0 shadow-md transition-all rounded-l-full border-r-0
            px-3 py-2 gap-1
            ${useDb
              ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white border border-pink-500"
              : "bg-muted text-muted-foreground border border-gray-300"
            }
            hover:border-pink-400 focus:outline-none`}
        >
          {selectedDb === "files" && searchModes[0].icon}
          {selectedDb === "ktdb" && searchModes[1].icon}
          {selectedDb === "ibt" && searchModes[2].icon}
          <span className="hidden text-xs sm:text-sm md:flex items-center gap-1">
            {useDb && selectedDb && (
              <span className="text-white/80 sm:ml-1">
                ({searchModes.find((m) => m.value === selectedDb)?.label ?? selectedDb})
              </span>
            )}
            {!useDb && <span className="hidden sm:inline">内部データ</span>}
          </span>
        </button>

        <button
          onClick={handleChevronClick}
          className={`h-[40px] px-2 py-2 rounded-r-full shadow-md border-l-0 transition-all border ${useDb
            ? "bg-gradient-to-r from-pink-400 to-pink-500 text-white border-pink-500"
            : "bg-muted text-muted-foreground border-gray-300"
            } hover:border-pink-400 focus:outline-none`}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : "rotate-0"
              }`}
          />
        </button>
      </div>

      {isDropdownOpen &&
        createPortal(
          <motion.div
            id="select-database-options"
            ref={dropdownRef}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="fixed z-[100] w-auto min-w-[8rem] sm:w-40
  bg-white border border-gray-200 rounded-xl shadow-lg p-1 max-h-[40vh] overflow-y-auto overscroll-contain"
            style={{
              top: coords.top,
              left: coords.left,
            }}
          >
            {searchModes.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setSelectedDb(item.value);
                  setUseDb(true);
                  setIsDropdownOpen(false);
                }}
                className={`flex flex-col items-start w-full px-3 py-2 text-sm rounded-md transition text-left ${selectedDb === item.value
                  ? "bg-pink-200 text-pink-800"
                  : "hover:bg-pink-100"
                  }`}
              >
                <div className="flex w-full justify-between items-center">
                  <div className="flex space-x-2 justify-between items-center">
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>,
          document.body
        )}
    </div>
  );
}