import React from "react";
import { useLocation, BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";

// Pages
import CreateAccount from "./pages/CreateAccount";
import Login from "./pages/LoginModal";
import Dashboard from "./pages/Dashboard";
import VenueRankerPage from "./pages/VenueRankerPage";
import DoorTransition from "./pages/DoorTransition";

// Venue Ranker Intro Screens
import DesertDreamIntro from "./components/VenueRanker/desert-dream-intro";
import DistinctlyArizonaIntro from "./components/VenueRanker/distinctly-arizona-intro";
import GardenGreeneryIntro from "./components/VenueRanker/garden-greenery-intro";
import IndustrialIntro from "./components/VenueRanker/industrial-intro";
import ModernIntro from "./components/VenueRanker/modern-intro";
import RusticChicIntro from "./components/VenueRanker/rustic-chic-intro";

// Venue Ranker Video Screens
import BatesMansion from "./components/VenueRanker/BatesMansion";
import DesertFoothills from "./components/VenueRanker/DesertFoothills";
import Encanterra from "./components/VenueRanker/Encanterra";
import Fabric from "./components/VenueRanker/Fabric";
import FarmHouse from "./components/VenueRanker/FarmHouse";
import HaciendaDelSol from "./components/VenueRanker/HaciendaDelSol";
import HotelValleyHo from "./components/VenueRanker/HotelValleyHo";
import LakeHouse from "./components/VenueRanker/LakeHouse";
import Ocotillo from "./components/VenueRanker/Ocotillo";
import RubiHouse from "./components/VenueRanker/RubiHouse";
import SchnepfBRB from "./components/VenueRanker/SchnepfBarn";
import Soho63 from "./components/VenueRanker/Soho63";
import Sunkist from "./components/VenueRanker/Sunkist";
import TheMeadow from "./components/VenueRanker/TheMeadow";
import TheVic from "./components/VenueRanker/TheVic";
import Tubac from "./components/VenueRanker/Tubac";
import VerradoGolfClub from "./components/VenueRanker/VerradoGolfClub";
import WindMillBRB from "./components/VenueRanker/WindmillBarn";

// Other Screens
import VenueRankerIntro from "./components/VenueRanker/VenueRankerIntro";
import VenueVibeSelector from "./components/VenueRanker/VenueVibeSelector";
import ScrollOfPossibilities from "./components/VenueRanker/ScrollofPossibilities";
import CompareVenues from "./components/VenueRanker/CompareVenues";

interface BaseProps {
  locationState: any;
  onClose?: () => void;
  onBackToVibe?: () => void;
}

type ComponentWithLocationState<P = {}> = React.ComponentType<P & BaseProps>;

type PassLocationStateToComponentProps<P> = {
  Component: ComponentWithLocationState<P>;
  additionalProps?: Omit<P, keyof BaseProps>;
};

function PassLocationStateToComponent<P>({ 
  Component,
  additionalProps = {} as Omit<P, keyof BaseProps>
}: PassLocationStateToComponentProps<P>) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const props = {
    ...additionalProps,
    locationState: location.state || { screenList: [], currentIndex: 0 },
    onClose: () => navigate("/dashboard"),
    onBackToVibe: () => navigate("/venue-ranker/vibe")
  } as unknown as P & BaseProps;
  
  return <Component {...props} />;
}

const App = () => {
  const handleClose = () => {
    const location = useLocation();
    const { screenList, currentIndex } = location.state || {};
    if (screenList && typeof currentIndex === "number") {
      localStorage.setItem("rankerState", JSON.stringify({ screenList, currentIndex }));
    }
  };

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<CreateAccount />} />
        <Route path="/login" element={<Login />} />

        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/venue-ranker" element={<VenueRankerPage />} />
        <Route path="/transition" element={<DoorTransition />} />
        
        {/* Venue Ranker Intro Screens */}
        <Route 
          path="/venue-ranker/garden-greenery" 
          element={<PassLocationStateToComponent Component={GardenGreeneryIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        <Route 
          path="/venue-ranker/desert-dream" 
          element={<PassLocationStateToComponent Component={DesertDreamIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        <Route 
          path="/venue-ranker/distinctly-arizona" 
          element={<PassLocationStateToComponent Component={DistinctlyArizonaIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        <Route 
          path="/venue-ranker/industrial" 
          element={<PassLocationStateToComponent Component={IndustrialIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        <Route 
          path="/venue-ranker/modern" 
          element={<PassLocationStateToComponent Component={ModernIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        <Route 
          path="/venue-ranker/rustic-chic" 
          element={<PassLocationStateToComponent Component={RusticChicIntro} additionalProps={{ onClose: handleClose }} />} 
        />
        
        {/* Venue Ranker Video Screens */}
        <Route path="/venue-ranker/bates-mansion" element={<PassLocationStateToComponent Component={BatesMansion} />} />
        <Route path="/venue-ranker/desert-foothills" element={<PassLocationStateToComponent Component={DesertFoothills} />} />
        <Route path="/venue-ranker/encanterra" element={<PassLocationStateToComponent Component={Encanterra} />} />
        <Route path="/venue-ranker/fabric" element={<PassLocationStateToComponent Component={Fabric} />} />
        <Route path="/venue-ranker/farm-house" element={<PassLocationStateToComponent Component={FarmHouse} />} />
        <Route path="/venue-ranker/hacienda-del-sol" element={<PassLocationStateToComponent Component={HaciendaDelSol} />} />
        <Route path="/venue-ranker/hotel-valley-ho" element={<PassLocationStateToComponent Component={HotelValleyHo} />} />
        <Route path="/venue-ranker/lake-house" element={<PassLocationStateToComponent Component={LakeHouse} />} />
        <Route path="/venue-ranker/ocotillo" element={<PassLocationStateToComponent Component={Ocotillo} />} />
        <Route path="/venue-ranker/rubi-house" element={<PassLocationStateToComponent Component={RubiHouse} />} />
        <Route path="/venue-ranker/schnepf-brb" element={<PassLocationStateToComponent Component={SchnepfBRB} />} />
        <Route path="/venue-ranker/soho63" element={<PassLocationStateToComponent Component={Soho63} />} />
        <Route path="/venue-ranker/sunkist" element={<PassLocationStateToComponent Component={Sunkist} />} />
        <Route path="/venue-ranker/the-meadow" element={<PassLocationStateToComponent Component={TheMeadow} />} />
        <Route path="/venue-ranker/the-vic" element={<PassLocationStateToComponent Component={TheVic} />} />
        <Route path="/venue-ranker/tubac" element={<PassLocationStateToComponent Component={Tubac} />} />
        <Route path="/venue-ranker/verrado-golf-club" element={<PassLocationStateToComponent Component={VerradoGolfClub} />} />
        <Route path="/venue-ranker/windmill-brb" element={<PassLocationStateToComponent Component={WindMillBRB} />} />

        {/* Other Routes */}
        <Route path="/venue-ranker/vibe" element={<VenueVibeSelector onClose={() => {}} onBackToIntro={() => {}} />} />
        <Route path="/venue-ranker-intro" element={<VenueRankerIntro onContinue={() => {}} onExit={() => {}} />} />
        
        {/* Scroll of Possibilities Route */}
        <Route 
          path="/venue-ranker/scroll-of-possibilities" 
          element={<PassLocationStateToComponent Component={ScrollOfPossibilities} />}
        />

        {/* Compare Venues Route */}
        <Route 
          path="/venue-ranker/compare-venues" 
          element={<PassLocationStateToComponent Component={CompareVenues} />}
        />
      </Routes>
    </Router>
  );
};

export default App;