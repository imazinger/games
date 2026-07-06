// Firebase プロジェクトの設定をここに貼り付ける。
// 手順は README.md の「オンライン対戦のセットアップ」を参照。
// Firebase Console > プロジェクトの設定 > マイアプリ > SDK の設定と構成 からコピーできる。
export const firebaseConfig = {
  apiKey: "AIzaSyDxWt1vEjZ7AzIZOpNJHfohJG3d7iX8Xag",
  authDomain: "bear-reversi.firebaseapp.com",
  databaseURL: "https://bear-reversi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bear-reversi",
  storageBucket: "bear-reversi.firebasestorage.app",
  messagingSenderId: "4101990066",
  appId: "1:4101990066:web:7895471385c0a175094bab"
};

export function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);
}
