<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
  // Preluăm datele din formular
  $nume = htmlspecialchars($_POST['nume']);
  $email = htmlspecialchars($_POST['email']);
  $telefon = htmlspecialchars($_POST['telefon']);
  $oras = htmlspecialchars($_POST['oras']);
  $specializari = htmlspecialchars($_POST['specializari']);
  $portofoliu = htmlspecialchars($_POST['portofoliu']);

  // Email către admin
  $to = "contul@tau.ro"; // 🔁 înlocuiește cu adresa ta reală
  $subject = "Aplicare nouă bucătar: $nume";
  $message = "Ai primit o aplicație nouă:\n\n"
           . "Nume: $nume\n"
           . "Email: $email\n"
           . "Telefon: $telefon\n"
           . "Oraș: $oras\n"
           . "Specializări: $specializari\n"
           . "Portofoliu: $portofoliu\n";
  $headers = "From: no-reply@siteultau.ro";

  // Trimitem email
  if (mail($to, $subject, $message, $headers)) {
    echo "<h3>✅ Aplicația a fost trimisă cu succes!</h3>";
  } else {
    echo "<h3>❌ Eroare la trimitere. Încearcă din nou.</h3>";
  }
} else {
  echo "Formular invalid.";
}
?>
