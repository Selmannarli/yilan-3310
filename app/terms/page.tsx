export const metadata = {
  title: "Kullanım Koşulları | SHOT!",
  description: "SHOT! uygulamasının kullanım koşulları.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <a className="legal-back" href="/">← SHOT! ana sayfa</a>
        <h1>Kullanım Koşulları</h1>
        <p className="legal-date">Son güncelleme: 24 Ağustos 2026</p>
        <article className="legal-copy">
          <section>
            <h2>Hizmetin kullanımı</h2>
            <p>SHOT! arkadaş grupları için eğlence amaçlı bir parti oyunudur. Uygulamayı kullanarak bu koşullara uymayı ve bulunduğunuz yerdeki yasalara uygun davranmayı kabul edersiniz.</p>
          </section>
          <section>
            <h2>Yaş ve sorumlu kullanım</h2>
            <p>Uygulama 18 yaş ve üzeri kullanıcılar içindir. Alkol tüketmek zorunlu değildir ve tüm içerikler alkolsüz biçimde oynanabilir. Kullanıcılar kendi sağlıklarından, güvenliklerinden ve sorumlu davranışlarından kendileri sorumludur. Araç kullanmadan önce veya riskli durumlarda alkol tüketmeyin.</p>
          </section>
          <section>
            <h2>Hesap ve davranış</h2>
            <p>Google ile giriş isteğe bağlıdır. Hesabınız ve cihazınızdaki işlemlerden siz sorumlusunuz. Hizmeti kötüye kullanamaz, başkalarını rahatsız edemez, sisteme yetkisiz erişmeye çalışamaz veya zararlı içerik gönderemezsiniz.</p>
          </section>
          <section>
            <h2>Hizmet değişiklikleri</h2>
            <p>Özellikler zaman zaman güncellenebilir, değiştirilebilir veya geçici olarak kullanılamayabilir. Hizmet kesintisiz ya da hatasız sunulacağına dair garanti verilmez.</p>
          </section>
          <section>
            <h2>İletişim</h2>
            <p>Bu koşullarla ilgili sorularınız için <a href="mailto:selman.narli@gmail.com">selman.narli@gmail.com</a> adresinden iletişime geçebilirsiniz.</p>
          </section>
          <section className="legal-language" lang="en">
            <h2>Terms of Use</h2>
            <p>SHOT! is an entertainment party game for users aged 18 and over. Alcohol is never required and every activity can be played alcohol-free. You are responsible for complying with local laws and for your own health, safety, account, device, and conduct. Do not misuse the service, harass others, attempt unauthorized access, or submit harmful content. Features may change or become temporarily unavailable, and uninterrupted or error-free service is not guaranteed. Questions can be sent to <a href="mailto:selman.narli@gmail.com">selman.narli@gmail.com</a>.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
