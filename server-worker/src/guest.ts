import type {Auth} from './types';
export const guestAuth=():Auth=>({user:{id:'',username:'',display_name:'Guest',role:'guest',status:'active',used_bytes:0,quota_bytes:0,invites_left:0,created_at:0},session:{id:'',user_id:'',device_label:'',created_at:0,last_seen_at:0,expires_at:0}});
