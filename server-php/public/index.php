<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
http_response_code(503);
echo json_encode(['error'=>['code'=>'milestone_pending','message'=>'The production PHP backend arrives in M1. Run npm run dev:demo for the M0 preview.']]);
