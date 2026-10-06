import Hero from '@/components/hero/Hero';
import Vision from '@/components/vision/Vision';
import Footer from '@/components/footer/Footer';
import Careers from '@/components/careers/Careers';
import Team from '@/components/team/Team';

export default function Home() {
  return (
    <main>
      <Hero />
      <Vision />
      <Team />
      <Careers />
      <Footer />
    </main>
  );
}
