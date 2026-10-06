import { useState } from "react";
import {
  CalendarDays,
  Edit,
} from "lucide-react";

function ProfileInformation({displayName}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [profile, setProfile] = useState({
    firstName:"",
    lastName:"",
    middleName:"",
    nameSuffix:"",
    age: "",
    gender: "",
    birthday: "",
    address:"",
    province: "",
    municipality: "",
  });

  // Updates the selected profile field
  const handleChange = (field, value) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  return (
    <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm sm:p-5">

      {/* Profile Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
            {displayName.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <h2 className="text-base font-bold text-[#102f53]">
              {displayName}
            </h2>

            <p className="text-[10px] text-blue-500">
              Personal Information
            </p>
          </div>
        </div>

        {/* Edit Button */}
        <button
          type="button"
          onClick={() => {
            if (isEditing) {
              setShowConfirmation(true);
            } else {
              setIsEditing(true);
            }
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-400 text-blue-600 transition hover:bg-blue-50"
        >
          <Edit size={15} />
        </button>

      </div>

      {/* Personal Information */}
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">

        {/* First Name */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            First Name
          </label>

          <input
            type="text"
            value={profile.firstName}
            placeholder="Enter first name"
            readOnly={!isEditing}
            onChange={(e) => handleChange("firstName", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                : "border-0 bg-transparent px-0 py-1 text-slate-400"
            }`}
          />
        </div>

        {/* Middle Name */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Middle Name
          </label>

          <input
            type="text"
            value={profile.middleName}
            placeholder="Enter middle name"
            readOnly={!isEditing}
            onChange={(e) => handleChange("middleName", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                : "border-0 bg-transparent px-0 py-1 text-slate-400"
            }`}
          />
        </div>

        {/* Last Name */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Last Name
          </label>

          <input
            type="text"
            value={profile.lastName}
            placeholder="Enter last name"
            readOnly={!isEditing}
            onChange={(e) => handleChange("lastName", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                : "border-0 bg-transparent px-0 py-1 text-slate-400"
            }`}
          />
        </div>

        {/* Name Suffix */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Name Suffix
          </label>

          <input
            type="text"
            value={profile.nameSuffix}
            placeholder="e.g. Jr., Sr., III"
            readOnly={!isEditing}
            onChange={(e) => handleChange("nameSuffix", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                : "border-0 bg-transparent px-0 py-1 text-slate-400"
            }`}
          />
        </div>

        {/* Age */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Age
          </label>

          <input
            type="number"
            value={profile.age}
            placeholder="Enter age"
            disabled={!isEditing}
            onChange={(e) => handleChange("age", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                : "border-0 bg-transparent px-0 py-1 text-slate-400 placeholder:text-slate-400"
            }`}
          />
        </div>

        {/* Gender */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Gender
          </label>

          <select
            value={profile.gender}
            disabled={!isEditing}
            onChange={(e) => handleChange("gender", e.target.value)}
            className={`mt-1 w-full text-[10px] outline-none ${
              isEditing
                ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-500"
                : "border-0 bg-transparent px-0 py-1 text-slate-400"
            }`}
          >
            <option value="" disabled>
              Select gender
            </option>

            <option value="male">
              Male
            </option>

            <option value="female">
              Female
            </option>
          </select>
        </div>

        {/* Birthday */}
        <div>
          <label className="text-[10px] font-semibold text-[#102f53]">
            Birthday
          </label>

          <div className="relative">
            <input
              type="text"
              value={profile.birthday}
              onChange={(e) => handleChange("birthday", e.target.value)}
              placeholder="MM/DD/YYYY"
              disabled={!isEditing}
              className={`mt-1 w-full text-[10px] outline-none ${
                isEditing
                  ? "rounded-md border border-blue-100 bg-white px-3 py-2 pr-9 text-slate-600 placeholder:text-slate-400"
                  : "border-0 bg-transparent px-0 py-1 text-slate-400 placeholder:text-slate-400"
              }`}
            />

            {isEditing && (
              <CalendarDays
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-blue-600"
              />
            )}
          </div>
        </div>

      </div>

      {/* Address */}
      <div className="mt-4">

        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-[#102f53]">
            Address
          </h3>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">


          {/* House Number / Street Address */}
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-[#102f53]">
              House Number / Street Address
            </label>

            <input
              type="text"
              value={profile.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Enter house number and street address"
              disabled={!isEditing}
              className={`mt-1 w-full text-[10px] outline-none ${
                isEditing
                  ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-600 placeholder:text-slate-400"
                  : "border-0 bg-transparent px-0 py-1 text-slate-400"
              }`}
            />
          </div>

          {/* Province */}
          <div>
            <label className="text-[10px] font-semibold text-[#102f53]">
              Province
            </label>

            <select
              value={profile.province}
              onChange={(e) => handleChange("province", e.target.value)}
              disabled={!isEditing}
              className={`mt-1 w-full text-[10px] outline-none ${
                isEditing
                  ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-500"
                  : "border-0 bg-transparent px-0 py-1 text-slate-400"
              }`}
            >
              <option value="" disabled>
                Select province
              </option>
            </select>
          </div>

          {/* Municipality / City */}
          <div>
            <label className="text-[10px] font-semibold text-[#102f53]">
              Municipality / City
            </label>

            <select
              value={profile.municipality}
              onChange={(e) => handleChange("municipality", e.target.value)}
              disabled={!isEditing}
              className={`mt-1 w-full text-[10px] outline-none ${
                isEditing
                  ? "rounded-md border border-blue-100 bg-white px-3 py-2 text-slate-500"
                  : "border-0 bg-transparent px-0 py-1 text-slate-400"
              }`}
            >
              <option value="" disabled>
                Select municipality or city
              </option>
            </select>
          </div>

        </div>
      </div>

      {/* Confirmation Popup */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">

          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">

            {/* Popup Content */}
            <div className="text-center">
              <h2 className="text-base font-bold text-[#102f53]">
                Confirm Changes
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Are you sure you want to save the changes you made to your profile?
              </p>
            </div>

            {/* Popup Actions */}
            <div className="mt-6 flex justify-center gap-3">

              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="min-w-[100px] rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirmation(false);
                  setIsEditing(false);
                }}
                className="min-w-[120px] rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
              >
                Confirm Changes
              </button>

            </div>

          </div>
        </div>
      )}

    </section>
  );
}

export default ProfileInformation;