import type {ImagePickerAsset} from 'expo-image-picker';
// The picker opens in the original tap; Safari must not wait for a server request first.
export const pendingPhotos=new Map<string,{web?:File[];native?:ImagePickerAsset[]}>();
