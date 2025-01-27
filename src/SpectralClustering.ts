import { Utils } from "./Utils";
import { Graph } from "./Graph";
import { Matrix, EigenvalueDecomposition } from 'ml-matrix';
import { Kmeans1D } from "./Kmeans1D";

/**
 * Class dedicated to spectral clustering : 
 * * compute the eigen values
 * * sort the eigen vectors accorting to the eigen values
 * * focus on the 2nd eiven vector (Fiedler's)
 * * run a k-means to cluster the components of the Fiedler's vector
 */
export class SpectralClustering {	
    private graph: Graph;

    constructor(graph : Graph){
        this.graph = graph;
    }

    public compute(options = new Map<string, string|number>()):void{
        const runningOptions = this.getRunningOptions(options);

        const eigen = this.getEigenDecomposition(runningOptions);
        const nodes = this.graph.getNodes();

        // the eigen vectors & values are already sorted
        // there is not need to do it again

        const fiedlerVector = eigen.eigenvectorMatrix.getColumn(1);

        // k-means to divide the FiedlerVector

        const kmeanCluster = new Kmeans1D(fiedlerVector);

        // is the number of clusters already known ?
        const requestedNbClusters = <number>(runningOptions.get("requestedNbClusters"));
        let clusterResult = null;
        if (requestedNbClusters == -1){
            clusterResult = kmeanCluster.findBestClustering( <number>(runningOptions.get("maxClusters")) );
        }else{
            // the methods returns [clusters, centroids], let's keep the clusters only
            clusterResult = kmeanCluster.tryToCluster(requestedNbClusters)[0];
        }

        for (let i = 0; i<fiedlerVector.length; i++){
            const nodeI = nodes[i];
            nodeI.setCluster(clusterResult[i]);
        }
    }

    public getProjection(options = new Map<string, string|number>(), dimensions): {[id:string]: [number]}[]{
        const runningOptions = this.getRunningOptions(options);

        const eigen = this.getEigenDecomposition(runningOptions);
        const nodes = this.graph.getNodes();
        let projections: {[id:string]: [number]}[] = [];

        for (let i = 0; i < nodes.length; i++){
            const node = nodes[i];
            const row = eigen.eigenvectorMatrix.getRow(i);
            projections[node.getId()] = row.slice(1, dimensions + 1);
        }

        return projections;
    }

    private getEigenDecomposition(runningOptions: Map<string, string | number>) {
        let laplacianMatrix = null;
        if (runningOptions.get("laplacianMatrix") == "connected") {
            laplacianMatrix = this.extractStrictLaplacianMatrix();
        } else {
            laplacianMatrix = this.extractDistanceLaplacianMatrix();
        }

        const eigen = new EigenvalueDecomposition(laplacianMatrix, { assumeSymmetric: true });
        return eigen;
    }

    private getRunningOptions(options: Map<string, string | number>) {
        const defaultOptions = new Map<string, string | number>([
            ["laplacianMatrix", "connected"],
            ["requestedNbClusters", -1],
            ["maxClusters", 8]
        ]);
        const runningOptions = Utils.resolveRunningParameters(defaultOptions, options);
        return runningOptions;
    }

    private extractStrictLaplacianMatrix(): Matrix{
        const result = new Matrix(this.graph.getNodes().length, this.graph.getNodes().length);

        const nodes = this.graph.getNodes();

        for (let i = 0; i<nodes.length; i++){
            const nodeI = nodes[i];
            const connected = nodeI.getConnectedNodes();

            for (let j = 0; j<nodes.length; j++){
                const nodeJ = nodes[j];
                if (nodeI.isConnectedTo(nodeJ)){
                    result.set(i,j,-1);
                }
            }    
            
            result.set(i,i, connected.size );
        }

        return result;
    }

    /**
     * Build a matrix showing the distance of nodes
     */
    private extractDistanceLaplacianMatrix(): Matrix{
        const result = new Matrix(this.graph.getNodes().length, this.graph.getNodes().length);

        const nodes = this.graph.getNodes();

        for (let i = 0; i<nodes.length; i++){
            const nodeI = nodes[i];
            let sumDistances = 0;

            for (let j = 0; j<nodes.length; j++){
                if (i != j){
                    const nodeJ = nodes[j];

                    if (nodeI.isConnectedTo(nodeJ)){
                        const distance = nodeI.getPoint().euclieanDistanceTo(nodeJ.getPoint());

                        //let distanceInLaplacian = 1/distance;
                        const distanceInLaplacian = 1/Math.log10(distance);

                        result.set(i,j, -distanceInLaplacian);
                        
                        sumDistances += distanceInLaplacian;
                    }
                }
            }            

            result.set(i,i, sumDistances);
        }

        return result;
    }
}