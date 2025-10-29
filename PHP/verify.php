<?php
if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $address = $_POST['address'] ?? '';
  $signature = $_POST['signature'] ?? '';

  if ($address && $signature) {
    $log = date("Y-m-d H:i:s") . " | " . $address . " | " . $signature . "\n";
    file_put_contents("wallet_log.txt", $log, FILE_APPEND);

    echo "✅ Autentificare reușită: $address";
  } else {
    echo "❌ Eroare: date lipsă.";
  }
}
?>
