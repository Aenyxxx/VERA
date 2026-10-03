import { Send } from "lucide-react";

function ApplicationActions({
  selectedCount,
  onCancel,
  onSubmit,
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-blue-100 pt-3">
      <p className="text-[9px] text-slate-500 sm:text-[10px]">
        {selectedCount} {selectedCount === 1 ? "document" : "documents"} selected
      </p>

      <button
        type="button"
        onClick={onSubmit}
        className="flex min-w-[120px] items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-[10px] font-semibold text-white transition hover:bg-blue-700 sm:text-xs"
      >
        Submit
        <Send size={14} />
      </button>
    </div>
  );
}

export default ApplicationActions;