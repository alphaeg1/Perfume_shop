// اربط الموقع بالسيستم: الإعدادات دي بتتحمل من تبويب "الموقع" في البرنامج (زرار تحميل config.js)
window.SHOP_CONFIG = {
  "dbUrl": "https://perfume-shop-dfd5a-default-rtdb.europe-west1.firebasedatabase.app",
  "apiKey": "AIzaSyCV_TQxw3Ec-N_VYyKO3PcCKPjuLaENfNM"
};
(function(){ // theme + font for the shop and follow-up pages
  var d=document,t='light';try{t=localStorage.getItem('theme')||'light'}catch(e){}
  d.documentElement.setAttribute('data-theme',t);
  var f=d.createElement('link');f.rel='stylesheet';f.href='https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap';d.head.appendChild(f);
  var c=d.createElement('link');c.rel='stylesheet';c.href='theme.css?v=1';d.head.appendChild(c);
  var mo='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var su='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  d.addEventListener('DOMContentLoaded',function(){var b=d.createElement('button');b.className='th-btn';b.title='فاتح / غامق';
    var p=function(){b.innerHTML=d.documentElement.getAttribute('data-theme')==='dark'?su:mo};p();
    b.onclick=function(){var n=d.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';d.documentElement.setAttribute('data-theme',n);try{localStorage.setItem('theme',n)}catch(e){}p()};d.body.appendChild(b)});
})();
