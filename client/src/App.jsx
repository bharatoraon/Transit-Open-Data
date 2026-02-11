import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Maps from "./pages/Maps";
import Datasets from "./pages/Datasets";
// import Home2 from "./pages/Home2";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="maps" element={<Maps />} />
          <Route path="datasets" element={<Datasets />} />
          {/* <Route path="home2" element={<Home2 />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
