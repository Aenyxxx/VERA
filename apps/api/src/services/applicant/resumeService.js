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
    `${process.env.SVC_URL ?? "http://127.0.0.1:8000"}/process-resume`,
    {
      method: "POST",
      headers: { "X-Internal-Key": process.env.SVC_INTERNAL_KEY ?? "" },
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