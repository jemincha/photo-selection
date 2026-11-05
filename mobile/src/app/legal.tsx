import {router} from 'expo-router';
import {Page,Button} from '../ui';
export default function Legal(){return <Page title="개인정보 및 이용 약관"><Button label="개인정보 처리 및 사진 보관" onPress={()=>router.push('/privacy')}/><Button label="이용약관 및 커뮤니티 기준" onPress={()=>router.push('/terms')}/></Page>;}
