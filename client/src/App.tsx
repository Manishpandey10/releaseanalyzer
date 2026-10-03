import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CreateRelease from "./pages/CreateRelease";
import ReleaseDetail from "./pages/ReleaseDetail";
import ReleaseAnalysis from "./pages/ReleaseAnalysis";
import ReleaseReview from "./pages/ReleaseReview";
import ReleaseFinal from "./pages/ReleaseFinal";
import EditRelease from "./pages/EditRelease";
import CompareRelease from "./pages/CompareRelease";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateRelease />} />
        <Route path="/releases/:id" element={<ReleaseDetail />} />
        <Route path="/releases/:id/edit" element={<EditRelease />} />
        <Route path="/releases/:id/analysis" element={<ReleaseAnalysis />} />
        <Route path="/releases/:id/review" element={<ReleaseReview />} />
        <Route path="/releases/:id/final" element={<ReleaseFinal />} />
        <Route path="/releases/:id/compare/:otherId" element={<CompareRelease />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
