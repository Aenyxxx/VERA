export const processResume = async (file) => {
  const formData = new FormData();

  const blob = new Blob(
    [file.buffer],
    { type: file.mimetype }
  );

  formData.append(
    "file",
    blob,
    file.originalname
  );

  const response = await fetch(
    "http://localhost:8000/process-resume",
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.detail || "Resume processing failed"
    );
  }

  return data;
};