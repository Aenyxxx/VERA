import { FieldError } from "@/components/shared/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Decision 32: the client's final interview (Philippine time) and the details for the applicant, all required. Used by
 * Notify (the schedule goes into the information notice; decision 37B: nothing to confirm) and by Create endorsement (the same schedule is
 * set on every endorsed applicant).
 */
export function FinalInterviewFields({ idPrefix, value, errors = {}, onChange }) {
  const set = (key) => (event) => onChange({ ...value, [key]: event.target.value });
  const whenError = `${idPrefix}-when-error`;
  const detailsError = `${idPrefix}-details-error`;
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-body font-semibold text-heading">Final interview with the client (Philippine time)</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-date`}>Date</Label>
            <Input
              id={`${idPrefix}-date`}
              type="date"
              required
              value={value.date}
              aria-invalid={Boolean(errors.when)}
              aria-describedby={errors.when ? whenError : undefined}
              onChange={set("date")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-time`}>Time</Label>
            <Input
              id={`${idPrefix}-time`}
              type="time"
              required
              value={value.time}
              aria-invalid={Boolean(errors.when)}
              aria-describedby={errors.when ? whenError : undefined}
              onChange={set("time")}
            />
          </div>
        </div>
        <FieldError id={whenError} message={errors.when} />
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-details`}>Location and details</Label>
        <Textarea
          id={`${idPrefix}-details`}
          rows={3}
          required
          maxLength={500}
          value={value.details}
          aria-invalid={Boolean(errors.details)}
          aria-describedby={errors.details ? detailsError : undefined}
          onChange={set("details")}
        />
        <FieldError id={detailsError} message={errors.details} />
      </div>
    </div>
  );
}
