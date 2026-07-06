// Firebase プロジェクトの設定をここに貼り付ける。
// 手順は README.md の「オンライン対戦のセットアップ」を参照。
// Firebase Console > プロジェクトの設定 > マイアプリ > SDK の設定と構成 からコピーできる。
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);
}
