// Endorsement packet (decision 21, Oct 17, 2026): ONE PDF per endorsed applicant = a cover page with the applicant's
// competency evaluation, followed by the application's own resume (the file that was matched and verified).
// - Interview score, section scores, and section weights: the endorsed application's OWN final_evaluation and its
//   OWN vacancy (a rematch application shows the score re-weighted for that vacancy, e.g. Store Crew 83.33).
// - The 15 ratings and the "Agency interview date": the ratings source (the original interview, WSM-03).
// - Never on the cover: matching score, final score, rank, status, history, notes, other applicants, company.
// Built on request and never stored. The rating wording is RATING_INTERPRETATIONS (@vera/shared), the same text the
// evaluation form shows; section and item names come from the Competency Profile rubric (listRubric).
import { RATING_INTERPRETATIONS } from "@vera/shared";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { conflict } from "../../lib/errors.js";

const manilaDate = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
const score = (value) => Number(value).toFixed(2);
const percent = (value) => `${Number(value)}%`;

/** "Dela Cruz" → "Dela-Cruz", "Peña" → "Pena"; only A–Z, a–z, 0–9 and "-" stay. */
function filePart(text) {
  const plain = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "");
  return plain || "Applicant";
}

/** <LastName>_<FirstName>_<JobTitle>_Endorsement.pdf (decision 21). */
export function packetFileName({ lastName, firstName, jobTitle }) {
  return `${filePart(lastName)}_${filePart(firstName)}_${filePart(jobTitle)}_Endorsement.pdf`;
}

/**
 * What the cover says, from the stored rows (no score is recomputed).
 * @param {object} row findPacketData: names, jobTitle, interviewScore, sectionScores, interviewDate
 * @param {{ sectionCode: string, sectionName: string, items: { competencyId: string, competencyName: string }[] }[]} rubric
 * @param {{ competencyId: string, rating: number }[]} ratings the ratings source's 15 ratings
 * @param {{ sectionCode: string, weight: number|null }[]} weights the endorsed application's vacancy section weights
 */
export function packetContent(row, rubric, ratings, weights) {
  const ratingOf = new Map(ratings.map((r) => [r.competencyId, Number(r.rating)]));
  const sections = rubric.map((section) => {
    const items = section.items.map((item) => ({ name: item.competencyName, rating: ratingOf.get(item.competencyId) }));
    if (items.some((item) => !item.rating)) throw conflict("The evaluation does not have all Competency Profile ratings.");
    return {
      sectionCode: section.sectionCode,
      sectionName: section.sectionName,
      weight: Number(weights.find((w) => w.sectionCode === section.sectionCode)?.weight ?? 0),
      sectionScore: Number(row.sectionScores?.[section.sectionCode] ?? 0),
      items,
    };
  });
  return {
    fullName: [row.firstName, row.middleName, row.lastName, row.suffix].filter(Boolean).join(" "),
    jobTitle: row.jobTitle,
    interviewDate: row.interviewDate,
    interviewScore: Number(row.interviewScore),
    sections,
  };
}

/**
 * The cover as lines of text (pure, unit-tested). Each line: { text, bold?, size?, indent?, right? (rating column) }.
 * @param {ReturnType<typeof packetContent>} content
 * @param {Date} generatedAt
 */
export function coverLines(content, generatedAt = new Date()) {
  const lines = [
    { text: "Confiable Manpower Solutions Inc. · VERA", size: 10 },
    { text: "ENDORSEMENT PACKET — Competency Evaluation", bold: true, size: 16, gapAfter: 6 },
    { text: `Applicant: ${content.fullName}`, bold: true },
    { text: `Position: ${content.jobTitle}` },
    { text: `Agency interview date: ${content.interviewDate ? manilaDate.format(new Date(content.interviewDate)) : "—"}`, gapAfter: 6 },
  ];
  for (const section of content.sections) {
    lines.push({
      text: `${section.sectionCode}. ${section.sectionName} — weight ${percent(section.weight)}, section score ${score(section.sectionScore)}%`,
      bold: true,
      gapBefore: 4,
    });
    for (const item of section.items) lines.push({ text: item.name, indent: 14, right: String(item.rating) });
  }
  lines.push(
    { text: `Interview score: ${score(content.interviewScore)} / 100`, bold: true, size: 13, gapBefore: 8 },
    {
      text: "Section score = (mean rating - 1) / 4 x 100; interview score = sum of (section weight x section score) / 100.",
      size: 9,
    },
    { text: "Rating scale:", bold: true, size: 9, gapBefore: 4 },
    ...[1, 2, 3, 4, 5].map((n) => ({
      text: `${n}  ${RATING_INTERPRETATIONS[n].short} / ${RATING_INTERPRETATIONS[n].long}`,
      size: 9,
      indent: 14,
    })),
    {
      text: `The applicant's resume follows. Generated ${manilaDate.format(generatedAt)} (Philippine time) by VERA.`,
      size: 9,
      gapBefore: 8,
    },
  );
  return lines;
}

/** Text the standard PDF font cannot encode is replaced, character by character, with "?". */
function safeText(font, text) {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return "?";
      }
    })
    .join("");
}

/** Greedy word wrap to the page width. */
function wrap(font, text, size, width) {
  const out = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * The packet bytes: an A4 cover, then every page of the resume PDF.
 * @param {ReturnType<typeof packetContent>} content
 * @param {Uint8Array|Buffer} resumeBytes the application's own resume (original file)
 */
export async function buildPacket(content, resumeBytes, generatedAt = new Date()) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Endorsement packet - ${content.fullName}`);
  doc.setProducer("VERA");
  doc.setCreator("VERA");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]); // A4
  const margin = 50;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  for (const line of coverLines(content, generatedAt)) {
    const font = line.bold ? bold : regular;
    const size = line.size ?? 11;
    const indent = line.indent ?? 0;
    y -= line.gapBefore ?? 0;
    const parts = wrap(font, safeText(font, line.text), size, width - indent - (line.right ? 40 : 0));
    parts.forEach((part, index) => {
      y -= size * 1.4;
      page.drawText(part, { x: margin + indent, y, size, font, color: rgb(0.1, 0.1, 0.1) });
      if (line.right && index === 0) {
        page.drawText(line.right, { x: margin + width - 10, y, size, font: bold, color: rgb(0.1, 0.1, 0.1) });
      }
    });
    y -= line.gapAfter ?? 0;
  }

  try {
    const resume = await PDFDocument.load(resumeBytes, { ignoreEncryption: true });
    const pages = await doc.copyPages(resume, resume.getPageIndices());
    for (const resumePage of pages) doc.addPage(resumePage);
  } catch {
    throw conflict("The resume file could not be added. Download it from Resume Screening.");
  }
  return doc.save({ useObjectStreams: false }); // plain page objects: any PDF reader, and check-p2 can count pages
}
