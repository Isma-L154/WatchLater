/**
 * Setup for the browser test project.
 *
 * Loads the app's stylesheet, which is not optional here: these components are
 * styled entirely with utility classes, and a `ScrollRail` mounted without them
 * is a `display: block` element that cannot overflow — so every assertion about
 * arrows appearing, or focus moving between them, passes for the wrong reason
 * or fails for one. Without this import the suite silently tests an unstyled
 * component that the app never renders.
 */
import './src/routes/layout.css';
