// اربط الموقع بالسيستم: الإعدادات دي بتتحمل من تبويب "الموقع" في البرنامج (زرار تحميل config.js)
window.SHOP_CONFIG = {
  "dbUrl": "https://perfume-shop-dfd5a-default-rtdb.europe-west1.firebasedatabase.app",
  "apiKey": "AIzaSyCV_TQxw3Ec-N_VYyKO3PcCKPjuLaENfNM"
};
(function(){ // theme + font for the shop and follow-up pages
  var d=document,t='light';try{t=localStorage.getItem('theme')||'light'}catch(e){}
  d.documentElement.setAttribute('data-theme',t);
  var f=d.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap';d.head.appendChild(f);
  if(/admin\.html/.test(location.pathname))return; // the follow-up page has its own design + theme switch
  var c=d.createElement('link');c.rel='stylesheet';c.href='theme.css?v=1';d.head.appendChild(c);
})();
