// api/ai-menu.js
const PDFDocument = require("pdfkit");
const { Resend } = require("@resend/node");

function pdfToBuffer(doc){
  return new Promise((resolve, reject)=>{
    const chunks=[]; doc.on("data",c=>chunks.push(c));
    doc.on("end",()=>resolve(Buffer.concat(chunks)));
    doc.on("error",reject); doc.end();
  });
}

async function buildPDF(form){
  const doc = new PDFDocument({ size:"A4", margin:42 });
  doc.fontSize(20).text("Meniu personalizat (AI)").moveDown();
  doc.fontSize(10).text(`Nume: ${form.nume || "-"}`);
  doc.text(`Email: ${form.email || "-"}`).moveDown();
  // TODO: poți înlocui cu PDF-ul „profesional” din mesajul meu precedent
  return pdfToBuffer(doc);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try{
    const { form = {}, source } = req.body || {};
    if(!form.email || !form.nume) return res.status(400).json({ ok:false, error:"Missing required fields" });

    const pdfBuffer = await buildPDF(form);

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.FROM_EMAIL,               // ex: 'BP <no-reply@domeniul-tau.ro>'
      to: [form.email],
      bcc: process.env.INTERNAL_EMAIL ? [process.env.INTERNAL_EMAIL] : undefined,
      subject: "Meniul tău AI · Bucătarul Personal",
      text: `Salut ${form.nume}, găsești atașat meniul tău generat cu AI.`,
      attachments: [{ filename: "meniu-personalizat.pdf", content: pdfBuffer }],
    });

    res.status(200).json({ ok:true, sent:true, source: source || "static-page" });
  }catch(e){
    console.error(e);
    res.status(500).json({ ok:false, error:"Server error" });
  }
};
