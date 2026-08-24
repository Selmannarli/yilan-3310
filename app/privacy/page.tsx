export const metadata = {
  title: "Gizlilik Politikası | SHOT!",
  description: "SHOT! uygulamasının gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <a className="legal-back" href="/">← SHOT! ana sayfa</a>
        <h1>Gizlilik Politikası</h1>
        <p className="legal-date">Son güncelleme: 24 Ağustos 2026</p>
        <article className="legal-copy">
          <section>
            <h2>Topladığımız bilgiler</h2>
            <p>Google ile giriş yaptığınızda Google hesap kimliğiniz, e-posta adresiniz, görünen adınız ve profil görseliniz alınır. Ayrıca seçtiğiniz takma ad, avatar, dil, ses, titreşim ve animasyon tercihleri saklanabilir. Gönderdiğiniz geri bildirimler ve puanlar da kaydedilir.</p>
          </section>
          <section>
            <h2>Bilgileri nasıl kullanıyoruz?</h2>
            <p>Bilgiler hesabınızı tanımak, tercihlerinizi cihazlar arasında eşitlemek, çok oyunculu odaları çalıştırmak, hizmeti güvenli tutmak ve geri bildirimler doğrultusunda uygulamayı geliştirmek için kullanılır. Veriler reklam amacıyla satılmaz.</p>
          </section>
          <section>
            <h2>Google ile giriş</h2>
            <p>Google ile giriş isteğe bağlıdır. Kimlik doğrulama Google tarafından gerçekleştirilir; Google hesap parolanızı görmeyiz veya saklamayız. Google'ın veri kullanımı kendi gizlilik politikasına tabidir.</p>
          </section>
          <section>
            <h2>Saklama ve güvenlik</h2>
            <p>Oturumlar sınırlı süreli erişim anahtarlarıyla korunur. Hesap tercihleri ve geri bildirimler Cloudflare altyapısında saklanır. Hizmeti sağlamak ve yasal yükümlülükleri karşılamak için gereken süreden daha uzun tutulmamaları hedeflenir.</p>
          </section>
          <section>
            <h2>Tercihleriniz ve iletişim</h2>
            <p>Google hesabınızdan çıkış yapabilir ve uygulamayı hesap oluşturmadan kullanabilirsiniz. Verilerinize erişme veya silme talebi için <a href="mailto:selman.narli@gmail.com">selman.narli@gmail.com</a> adresine yazabilirsiniz.</p>
          </section>
          <section className="legal-language" lang="en">
            <h2>Privacy Policy</h2>
            <p>When you sign in with Google, we receive your Google account identifier, email address, display name, and profile image. We may store your nickname, avatar, language, sound, vibration, and motion preferences, as well as feedback you submit. We use this data to provide account sync, multiplayer rooms, security, and product improvements. We do not sell personal data for advertising. Google Sign-In is optional and we never receive your Google password. You can use the app without an account. To request access to or deletion of your data, contact <a href="mailto:selman.narli@gmail.com">selman.narli@gmail.com</a>.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
