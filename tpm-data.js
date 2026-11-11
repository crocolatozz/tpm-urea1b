// Master Database Rotasi 15 Hari TPM Urea 1B
const masterTPMUrea1B = {
  1:  { PAGI: "GA122", SORE: "GA123 & GB801", MALAM: "GB701" },
  2:  { PAGI: "GA101A", SORE: "GA103", MALAM: "GA104" },
  3:  { PAGI: "GA101B", SORE: "GA105", MALAM: "GA106" },
  4:  { PAGI: "GA102A", SORE: "GA107", MALAM: "GA109" },
  5:  { PAGI: "GA102B", SORE: "GA110", MALAM: "GA121" },
  6:  { PAGI: "GT 101", SORE: "GA201", MALAM: "GA204" },
  7:  { PAGI: "GB101LP", SORE: "GA401", MALAM: "GA402" },
  8:  { PAGI: "GB101HP", SORE: "GA403", MALAM: "GA404" },
  9:  { PAGI: "IA301", SORE: "GA405", MALAM: "GB 301" },
  10: { PAGI: "JW301", SORE: "GB302", MALAM: "GA301" },
  11: { PAGI: "JD301", SORE: "GA302", MALAM: "GA303" },
  12: { PAGI: "FD304", SORE: "GA501", MALAM: "GA502" },
  13: { PAGI: "FD305", SORE: "GA503", MALAM: "GA 504 & 704" },
  14: { PAGI: "GA 101A OIL", SORE: "GA 101B OIL", MALAM: "GA801 & GA803" },
  15: { PAGI: "GA 102A OIL", SORE: "GA 102B OIL", MALAM: "FLARE" }
};

function getScheduleForDate(dateStr) {
  if (!dateStr) return [];
  const dayOfMonth = parseInt(dateStr.split('-')[2], 10);
  
  if (dayOfMonth === 31) {
    return [{ shift: "INFO", text: "TIDAK ADA KEGIATAN", isOff: true }];
  }

  const cycleDay = ((dayOfMonth - 1) % 15) + 1;
  const dayData = masterTPMUrea1B[cycleDay];

  if (!dayData) return [];

  return [
    { shift: "PAGI", text: dayData.PAGI },
    { shift: "SORE", text: dayData.SORE },
    { shift: "MALAM", text: dayData.MALAM }
  ];
}

function formatDateIndo(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
