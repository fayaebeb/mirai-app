import { useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check, Database, DatabaseIcon, ArrowLeftRight, DatabaseZap } from "lucide-react";
import { useRecoilState } from "recoil";
import { dropdownOpenState } from "@/states/databaseDropdownState";
import { DbType } from "@shared/schema";

const searchModes = [
  { value: "data", label: "data", icon: <DatabaseIcon className="w-4 h-4" /> },
  { value: "db1", label: "db1", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: "db2", label: "db2", icon: <DatabaseZap className="w-4 h-4" /> },
];

export default function DbButton({
  useDb,
  setUseDb,
  selectedDb,
  setSelectedDb,
}: {
  useDb: boolean;
  setUseDb: (v: boolean) => void;
  selectedDb: DbType;
  setSelectedDb: (v: DbType) => void;
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
      <div ref={buttonGroupRef} className={`flex rounded-full border ${useDb ? "border-fuchsia-400" : "border-noble-black-900"} hover:border-fuchsia-400 `}>
        <button
          onClick={(e) => {
            e.preventDefault();
            setUseDb(!useDb);
          }}
          className={`h-8 sm:h-9 flex items-center justify-center flex-shrink-0 shadow-md transition-all rounded-l-full font-medium border-r-0
            px-2 py-2 sm:px-3 sm:py-1.5 gap-1
            ${useDb
              ? "bg-fuchsia-600/40 text-fuchsia-400  shadow-sm"
              : "bg-noble-black-900 text-noble-black-300"
            }
             focus:outline-none`}
        >

          {selectedDb === "data" && searchModes[0].icon}
          {selectedDb === "db1" && searchModes[1].icon}
          {selectedDb === "db2" && searchModes[2].icon}
          <span className="hidden md:flex items-center gap-1">
            {useDb && selectedDb && (
              <span className=" sm:ml-1">
                ({searchModes.find((m) => m.value === selectedDb)?.label ?? selectedDb})
              </span>
            )}
            {!useDb && <span className="hidden sm:inline">内部データ</span>}
          </span>
        </button>

        <button
          onClick={handleChevronClick}
          className={`h-8 sm:h-9 px-2 sm:px-3 py-2 sm:py-1.5 rounded-r-full shadow-md transition-all border font-medium ${useDb
            ? "bg-fuchsia-600/40 text-fuchsia-400 shadow-sm border-l-0.5 border-r-0 border-y-0 border-l-fuchsia-400"
            : "bg-noble-black-900 text-noble-black-300 border-y-0 border-r-0 border-l-0.5 border-l-noble-black-800"
            }  focus:outline-none`}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : "rotate-0"
              }`}
          />
        </button>
      </div>
      {/* <AnimatePresence>
        {isDropdownOpen &&
          createPortal(
            <motion.div
              id="select-database-options"
              ref={dropdownRef}
              initial={{ opacity: 0, y: -9 }}
              animate={{ opacity: 1, y: -4, }}
              exit={{ opacity: 0, y: -9 }}
              transition={{ duration: 0.2 }}
              className="fixed z-[100] w-auto min-w-[8rem] sm:w-40
  bg-noble-black-900 border border-noble-black-800 text-noble-black-100 rounded-xl shadow-lg p-1 max-h-[40vh] overflow-y-auto overscroll-contain"
              style={{
                top: coords.top,
                left: coords.left,
              }}
            >
              {searchModes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    if (item.label === 'うごき統計') setSelectedDb('うごき統計')
                    else if (item.label === '来た来ぬ') setSelectedDb('来た来ぬ統計')
                    else if (item.label === 'インバウンド') setSelectedDb('インバウンド統計')
                    setUseDb(true);
                    setIsDropdownOpen(false);
                  }}
                  className={`flex flex-col items-start w-full px-3 py-2 text-sm rounded-md transition text-left ${selectedDb === item.value
                    ? "bg-black text-noble-black-100"
                    : "hover:bg-noble-black-800"
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
      </AnimatePresence> */}

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                key="db-options"
                id="select-database-options"
                ref={dropdownRef}
                initial={{ opacity: 0, y: 9 }}
                animate={{ opacity: 1, y: -4 }}
                exit={{ opacity: 0, y: 9 }}
                transition={{ duration: 0.2 }}
                className="fixed z-[100] w-auto min-w-[8rem] sm:w-40
                  bg-noble-black-900 border border-noble-black-800
                  text-noble-black-100 rounded-xl shadow-lg p-1
                  max-h-[40vh] overflow-y-auto overscroll-contain"
                style={{ top: coords.top, left: coords.left }}
              >
                {searchModes.map(item => (
                  <button
                    key={item.value}
                    onClick={() => {
                      if (item.label === "data") setSelectedDb("data");
                      else if (item.label === "db1") setSelectedDb("db1");
                      else if (item.label === "db2") setSelectedDb("db2");
                      setUseDb(true);
                      setIsDropdownOpen(false);
                    }}
                    className={`flex flex-col items-start w-full px-3 py-2 text-sm rounded-md transition text-left ${selectedDb === item.value
                        ? "bg-black text-noble-black-100"
                        : "hover:bg-noble-black-800"
                      }`}
                  >
                    <div className="flex w-full justify-between items-center">
                      <div className="flex space-x-2 items-center">
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}