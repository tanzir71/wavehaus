INSERT INTO users(id,username,display_name,password_hash,role,created_at) VALUES('00000000000000000000000001','migration_fixture','Migration fixture','fixture-only','owner',1);
INSERT INTO artists(id,name,sort_name,tint,rev) VALUES('00000000000000000000000002','Fixture artist','Fixture artist',1,1);
INSERT INTO albums(id,owner_id,title,artist_id,tint,allow_homepage,created_at,rev) VALUES('00000000000000000000000003','00000000000000000000000001','Preserved album','00000000000000000000000002',1,1,1,2);
INSERT INTO tracks(id,owner_id,album_id,title,artist_name,duration_ms,storage_key,size_bytes,sha256,quick_hash,original_name,mime,added_at,updated_at,rev) VALUES('00000000000000000000000004','00000000000000000000000001','00000000000000000000000003','Preserved track','Fixture artist',1000,'media/fixture',44,'fixture-sha','fixture-quick','original.wav','audio/wav',1,1,3);
INSERT INTO showcase(item_type,item_id,position,featured,added_by,added_at) VALUES('album','00000000000000000000000003',0,1,'00000000000000000000000001',1);
INSERT INTO settings(key,value,updated_at) VALUES('homepage','{}',1);
UPDATE settings SET value='"Preserved settings"' WHERE key='server_name';
