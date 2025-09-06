<?php
require __DIR__.'/vendor/autoload.php';
use Minishlink\WebPush\VAPID;
$keys = VAPID::createVapidKeys();
echo "PUBLIC=".$keys['publicKey']."\nPRIVATE=".$keys['privateKey']."\n";
