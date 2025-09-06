<?php
header('Content-Type: application/json; charset=utf-8');
// CORS (dacă ai frontend pe alt domeniu):
// header('Access-Control-Allow-Origin: https://username.github.io');
// header('Access-Control-Allow-Methods: POST, OPTIONS');
// header('Access-Control-Allow-Headers: Content-Type');
// if ($_SERVER['REQUEST_METHOD']==='OPTIONS') { exit; }

if ($_SERVER['REQUEST_METHOD']!=='POST'){ http_response_code(405); echo json_encode(['success'=>false,'error'=>'Method not allowed']); exit; }
function val($k){ return isset($_POST[$k])?trim($_POST[$k]):''; }
function clean($s){ return htmlspecialchars($s, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8'); }

$oras=val('oras'); $eveniment=val('eveniment'); $data=val('data'); $persoane=val('persoane');
$buget=val('buget'); $preferinte=val('preferinte'); $nume=val('nume'); $email=val('email'); $telefon=val('telefon');

if($oras===''||$eveniment===''||$data===''||$persoane===''||$buget===''||$nume===''||$email===''){
  http_response_code(422); echo json_encode(['success'=>false,'error'=>'Completează câmpurile obligatorii.']); exit;
}

// rate limit 2 min / email
$hash=md5(strtolower($email)); $tmp=sys_get_temp_dir()."/bp_res_$hash"; $now=time();
if(file_exists($tmp) && $now - intval(file_get_contents($tmp)) < 120){
  http_response_code(429); echo json_encode(['success'=>false,'error'=>'Ai trimis recent. Încearcă peste 2 minute.']); exit;
}
file_put_contents($tmp,(string)$now);

// CSV
$dir = __DIR__.'/../data'; if(!is_dir($dir)) @mkdir($dir,0775,true);
$csv = $dir.'/rezervari.csv'; $isNew = !file_exists($csv);
$fp = fopen($csv, $isNew?'w':'a');
if($isNew){ fputcsv($fp, ['timestamp','nume','email','telefon','oras','eveniment','data','persoane','buget','preferinte','ip']); }
fputcsv($fp, [date('Y-m-d H:i:s'),$nume,$email,$telefon,$oras,$eveniment,$data,$persoane,$buget,$preferinte,$_SERVER['REMOTE_ADDR']??'']);
fclose($fp);

// Email
$admin_to = "contact@domeniul-tau.ro";
$from = "Bucătarul Personal <no-reply@domeniul-tau.ro>";
$subject = "✅ Cerere nouă: $nume ($oras • $eveniment)";
$headers  = "MIME-Version: 1.0\r\nContent-type: text/html; charset=utf-8\r\nFrom: $from\r\nReply-To: $nume <$email>\r\n";
$body = "<h2>Rezervare nouă</h2><p><strong>$nume</strong> ($email, $telefon)</p>
<table cellpadding='6' style='border-collapse:collapse'><tr><td><b>Oraș</b></td><td>".clean($oras)."</td></tr>
<tr><td><b>Eveniment</b></td><td>".clean($eveniment)."</td></tr>
<tr><td><b>Data</b></td><td>".clean($data)."</td></tr>
<tr><td><b>Persoane</b></td><td>".clean($persoane)."</td></tr>
<tr><td><b>Buget</b></td><td>".clean($buget)."</td></tr>
<tr><td><b>Preferințe</b></td><td>".nl2br(clean($preferinte))."</td></tr></table>";
@mail($admin_to,$subject,$body,$headers);
@mail($email,"Confirmare solicitare — Bucătarul Personal","<p>Mulțumim, $nume. Revenim cu oferta.</p>",$headers);

// Push către bucătari
require __DIR__.'/vendor/autoload.php';
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

$subsFile = __DIR__.'/../data/subscriptions.json';
$subs = is_file($subsFile) ? json_decode(file_get_contents($subsFile), true) : [];

$auth = ['VAPID'=>[
  'subject'=>'mailto:contact@domeniul-tau.ro',
  'publicKey'=>'REPLACE_WITH_PUBLIC_VAPID',
  'privateKey'=>'REPLACE_WITH_PRIVATE_VAPID'
]];
$webPush = new WebPush($auth);

$payload = json_encode([
  'title'=>'Rezervare nouă',
  'body'=>"$nume — $oras • $eveniment • $persoane pers • $data",
  'url'=>'/bp_chef_dashboard.html#calendar'
]);

foreach($subs as $chefEmail=>$list){
  foreach($list as $row){
    $subscription = Subscription::create($row['subscription']);
    $webPush->queueNotification($subscription, $payload);
  }
}
foreach($webPush->flush() as $report){ /* poți loga $report->isSuccess() */ }

echo json_encode(['success'=>true]);
