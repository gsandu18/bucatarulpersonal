<?php
require __DIR__ . '/vendor/autoload.php';
use Dompdf\Dompdf;
use PHPMailer\PHPMailer\PHPMailer;

$data = json_decode(file_get_contents("php://input"), true);
if(!$data){ echo json_encode(["success"=>false,"message"=>"Date invalide"]); exit; }

// === CONSTRUIRE PDF HTML ===
$html = "
<!DOCTYPE html>
<html lang='ro'>
<head>
<meta charset='UTF-8'>
<style>
  @page { margin: 40px 40px; }
  body {
    font-family: 'Inter', sans-serif;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.6;
    font-size: 14px;
  }
  h1,h2,h3 {
    font-family: 'Playfair Display', serif;
    color: #d4af37;
    margin: 0 0 10px;
  }
  .header {
    text-align: center;
    margin-bottom: 25px;
  }
  .header img {
    width: 160px;
    margin-bottom: 8px;
  }
  .line {
    height: 2px;
    background: #d4af37;
    margin: 10px auto 20px;
    width: 80%;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
  }
  th, td {
    border: 1px solid #ddd;
    padding: 10px 12px;
    text-align: left;
  }
  th {
    background: #fff8e1;
    color: #0e5a43;
  }
  .total {
    text-align: right;
    font-size: 16px;
    color: #0e5a43;
    font-weight: bold;
  }
  .footer {
    text-align: center;
    margin-top: 40px;
    font-size: 12px;
    color: #666;
  }
</style>
</head>

<body>
  <div class='header'>
    <img src='https://www.bucatarulpersonal.ro/static/logo-chefprive.png' alt='Chef Privé Logo'>
    <h2>Ofertă Personalizată — Chef Privé</h2>
    <div class='line'></div>
  </div>

  <h3>📋 Date client</h3>
  <p>
    <b>Nume:</b> {$data['nume']}<br>
    <b>Email:</b> {$data['email']}<br>
    <b>Oraș:</b> {$data['oras']}
  </p>

  <h3>🍽️ Detalii ofertă</h3>
  <table>
    <tr><th>Detaliu</th><th>Descriere</th></tr>
    <tr><td>Tip meniu</td><td>".ucfirst($data['tip'])."</td></tr>
    <tr><td>Complexitate</td><td>".ucfirst($data['complex'])."</td></tr>
    <tr><td>Număr persoane</td><td>{$data['persoane']}</td></tr>
    <tr><td>Logistică completă</td><td>".($data['logistica'] ? "Da (+1500 lei)" : "Nu")."</td></tr>
    <tr><td>Veselă & aparatură</td><td>".($data['vesela'] ? "Da (+50 lei/persoană)" : "Nu")."</td></tr>
  </table>

  <p class='total'>Total estimativ: {$data['total']} lei</p>

  <div class='footer'>
    <p>Ofertă generată automat prin platforma <b>Chef Privé</b> — <a href='https://chefprive.ro'>chefprive.ro</a></p>
    <p>Prețurile sunt estimative și pot fi ajustate în funcție de meniul final convenit, ingredientele alese și locația evenimentului.</p>
    <p style='margin-top:10px;'>© ".date("Y")." Bucătarul Personal SRL — Toate drepturile rezervate</p>
  </div>
</body>
</html>
";

// === GENERARE PDF ===
$pdf = new Dompdf();
$pdf->loadHtml($html);
$pdf->render();
$pdfPath = __DIR__."/oferta_".time().".pdf";
file_put_contents($pdfPath, $pdf->output());

// === TRIMITERE EMAIL ===
$mail = new PHPMailer(true);
try {
  $mail->isSMTP();
  $mail->Host = "smtp.yourserver.com"; // ← înlocuiește
  $mail->SMTPAuth = true;
  $mail->Username = "contatto@chefpersonale.com";
  $mail->Password = "PAROLA_TA";
  $mail->SMTPSecure = "tls";
  $mail->Port = 587;

  $mail->setFrom("contatto@chefpersonale.com", "Chef Privé");
  $mail->addAddress($data['email']);
  $mail->addBCC("contact@bucatarulpersonal.ro");
  $mail->Subject = "Ofertă personalizată — Chef Privé";
  $mail->Body = "Mulțumim pentru solicitarea ta!\nAtașat ai oferta estimativă în format PDF.";
  $mail->addAttachment($pdfPath);

  $mail->send();
  echo json_encode(["success"=>true,"message"=>"✅ Oferta PDF a fost trimisă pe e-mail."]);
} catch (Exception $e) {
  echo json_encode(["success"=>false,"message"=>"Eroare la trimitere: {$mail->ErrorInfo}"]);
}
?>
